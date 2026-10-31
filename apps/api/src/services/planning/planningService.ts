import type { AppDatabase } from "../../db/connection.js";
import { providerConfigs } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { GatewayError } from "../../ai/errors.js";
import { getAdapter } from "../../ai/registry.js";
import { getEffectiveSelection } from "../../ai/gateway.js";
import type { ResolvedProviderConfig, StreamEvent, TimeoutPolicy } from "../../ai/types.js";
import { createDocument, createVersion, listDocuments } from "../documentService.js";
import { getProject } from "../projectService.js";
import { readCredential } from "../providerService.js";
import { PLAN_TYPE_SPECS, buildQuestionsPrompt, buildSectionPrompt, buildSystemPrompt, truncate } from "./prompts.js";
import type { ChatMessage } from "../../ai/types.js";

export async function resolvePlanningProvider(
  db: AppDatabase,
  key: Buffer,
  projectId: string,
): Promise<{ config: ResolvedProviderConfig; model: string }> {
  const selection = await getEffectiveSelection(db, { projectId });
  if (!selection) {
    throw new GatewayError("NO_PROVIDER_CONFIGURED", "no provider configured; add one in Settings first");
  }
  const configRow = await db.select().from(providerConfigs).where(eq(providerConfigs.id, selection.providerId)).get();
  if (!configRow || !configRow.enabled) {
    throw new GatewayError("NO_PROVIDER_CONFIGURED", "configured provider is unavailable");
  }
  return {
    config: {
      id: configRow.id,
      label: configRow.label,
      protocol: configRow.protocol as ResolvedProviderConfig["protocol"],
      baseUrl: configRow.baseUrl,
      credential: await readCredential(db, key, configRow.id),
      enabled: configRow.enabled,
    },
    model: selection.modelId,
  };
}

async function buildContext(db: AppDatabase, projectId: string, includeUpstream: boolean): Promise<string> {
  const project = await getProject(db, projectId);
  const parts = [`Nama: ${project.name}`];
  if (project.description) parts.push(`Deskripsi: ${truncate(project.description, 2000)}`);
  if (project.ideaMd) parts.push(`Ide: ${truncate(project.ideaMd, 2000)}`);
  if (includeUpstream) {
    const docs = await listDocuments(db, projectId);
    for (const doc of docs) {
      if (doc.contentMd) parts.push(`--- ${doc.type} ---\n${truncate(doc.contentMd, 8000)}`);
    }
  }
  return parts.join("\n\n");
}

async function collectSection(
  config: ResolvedProviderConfig,
  model: string,
  messages: ChatMessage[],
  signal: AbortSignal,
  timeouts?: TimeoutPolicy,
): Promise<string> {
  const adapter = getAdapter(config.protocol);
  let out = "";
  for await (const event of adapter.streamChat(config, { model, messages, signal, maxOutputTokens: 1024 }, timeouts)) {
    const e: StreamEvent = event;
    if (e.type === "delta" && e.text) out += e.text;
  }
  return out.trim();
}

export async function generateQuestions(
  db: AppDatabase,
  key: Buffer,
  projectId: string,
  signal: AbortSignal,
  timeouts?: TimeoutPolicy,
): Promise<string[]> {
  const { config, model } = await resolvePlanningProvider(db, key, projectId);
  const context = await buildContext(db, projectId, false);
  const text = await collectSection(
    config,
    model,
    [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildQuestionsPrompt(context) },
    ],
    signal,
    timeouts,
  );
  const fenced = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(fenced);
  } catch {
    throw new GatewayError("MALFORMED_STREAM", "model did not return valid questions JSON");
  }
  if (parsed === null || typeof parsed !== "object" || !("questions" in parsed) || !Array.isArray((parsed as { questions: unknown }).questions)) {
    throw new GatewayError("MALFORMED_STREAM", "model did not return valid questions JSON");
  }
  const rawQuestions = (parsed as { questions: unknown }).questions;
  if (!Array.isArray(rawQuestions)) {
    throw new GatewayError("MALFORMED_STREAM", "model did not return valid questions JSON");
  }
  const questions = rawQuestions.filter((q): q is string => typeof q === "string" && q.length > 0).slice(0, 8);
  if (questions.length === 0) {
    throw new GatewayError("MALFORMED_STREAM", "model did not return valid questions JSON");
  }
  return questions;
}

export interface GeneratedDocument {
  documentId: string;
  versionNo: number;
}

export async function generateDocumentSections(
  db: AppDatabase,
  key: Buffer,
  projectId: string,
  documentType: string,
  opts: { signal: AbortSignal; timeouts?: TimeoutPolicy; onProgress?: (done: number, total: number, heading: string) => void },
): Promise<{ markdown: string; spec: (typeof PLAN_TYPE_SPECS)[string] }> {
  const spec = PLAN_TYPE_SPECS[documentType];
  if (!spec) throw new GatewayError("PROVIDER_MISCONFIGURED", `unknown document type: ${documentType}`);
  const { config, model } = await resolvePlanningProvider(db, key, projectId);
  const context = await buildContext(db, projectId, true);

  const sections: string[] = [];
  for (let i = 0; i < spec.sections.length; i++) {
    const section = spec.sections[i]!;
    opts.onProgress?.(i, spec.sections.length, section.heading);
    const text = await collectSection(
      config,
      model,
      [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildSectionPrompt(section, context) },
      ],
      opts.signal,
      opts.timeouts,
    );
    if (text.length < 20) {
      throw new GatewayError("MALFORMED_STREAM", `model returned an empty section: ${section.heading}`);
    }
    sections.push(`## ${section.heading}\n\n${text}`);
    opts.onProgress?.(i + 1, spec.sections.length, section.heading);
  }

  const markdown = `# ${spec.defaultTitle}\n\n${sections.join("\n\n")}`;
  const problem = spec.validate(markdown);
  if (problem) throw new GatewayError("MALFORMED_STREAM", problem);
  return { markdown, spec };
}

export async function saveGeneratedDocument(
  db: AppDatabase,
  projectId: string,
  documentType: string,
  title: string,
  markdown: string,
  fromApproved: boolean,
): Promise<GeneratedDocument> {
  const docs = await listDocuments(db, projectId);
  const existing = docs.find((d) => d.type === documentType);
  const upstream = docs
    .filter((d) => d.type !== documentType && d.currentVersionNo !== null)
    .map((d) => ({ documentId: d.id, versionNo: d.currentVersionNo as number }));
  const versionInput = { contentMd: markdown, origin: "ai" as const, fromApproved };
  if (existing) {
    const dto = await createVersion(db, existing.id, versionInput);
    return { documentId: dto.id, versionNo: dto.currentVersionNo ?? 1 };
  }
  const dto = await createDocument(db, projectId, {
    type: documentType as "PROJECT_BRIEF",
    title,
    contentMd: markdown,
    upstreamManifest: upstream.length > 0 ? { upstream } : undefined,
  });
  return { documentId: dto.id, versionNo: dto.currentVersionNo ?? 1 };
}
