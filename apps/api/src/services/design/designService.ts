import type { AppDatabase } from "../../db/connection.js";
import { GatewayError } from "../../ai/errors.js";
import { getAdapter } from "../../ai/registry.js";
import type { ResolvedProviderConfig, StreamEvent, TimeoutPolicy } from "../../ai/types.js";
import { createDocument, createVersion, listDocuments } from "../documentService.js";
import { getProject } from "../projectService.js";
import { resolvePlanningProvider } from "../planning/planningService.js";
import { DESIGN_SECTIONS, buildDesignSectionPrompt, buildDesignSystemPrompt, truncate, validateDesignSpec } from "./prompts.js";

export interface GeneratedDesign {
  documentId: string;
  versionNo: number;
}

async function collectSection(
  config: ResolvedProviderConfig,
  model: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
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

export async function generateDesignSpec(
  db: AppDatabase,
  key: Buffer,
  projectId: string,
  opts: { signal: AbortSignal; fromApproved?: boolean; timeouts?: TimeoutPolicy; onProgress?: (done: number, total: number, heading: string) => void },
): Promise<GeneratedDesign> {
  await getProject(db, projectId);
  const docs = await listDocuments(db, projectId);
  const prd = docs.find((d) => d.type === "PRD" && d.approvalState === "approved");
  if (!prd || !prd.contentMd) {
    throw new GatewayError("NEED_APPROVED_BASELINE", "design generation requires an approved PRD");
  }
  const { config, model } = await resolvePlanningProvider(db, key, projectId);
  const context = truncate(prd.contentMd, 12000);
  const upstream = [{ documentId: prd.id, versionNo: prd.currentVersionNo ?? 1 }];

  const sections: string[] = [];
  for (let i = 0; i < DESIGN_SECTIONS.length; i++) {
    const section = DESIGN_SECTIONS[i]!;
    opts.onProgress?.(i, DESIGN_SECTIONS.length, section.heading);
    const text = await collectSection(
      config,
      model,
      [
        { role: "system", content: buildDesignSystemPrompt() },
        { role: "user", content: buildDesignSectionPrompt(section, context) },
      ],
      opts.signal,
      opts.timeouts,
    );
    if (text.length < 20) {
      throw new GatewayError("MALFORMED_STREAM", `model returned an empty section: ${section.heading}`);
    }
    sections.push(`## ${section.heading}\n\n${text}`);
    opts.onProgress?.(i + 1, DESIGN_SECTIONS.length, section.heading);
  }

  const markdown = `# Spesifikasi Desain\n\n${sections.join("\n\n")}`;
  const problem = validateDesignSpec(markdown);
  if (problem) throw new GatewayError("MALFORMED_STREAM", problem);

  const existing = docs.find((d) => d.type === "DESIGN_SPEC");
  const versionInput = { contentMd: markdown, origin: "ai" as const, fromApproved: opts.fromApproved ?? false };
  if (existing) {
    const dto = await createVersion(db, existing.id, versionInput);
    return { documentId: dto.id, versionNo: dto.currentVersionNo ?? 1 };
  }
  const dto = await createDocument(db, projectId, {
    type: "DESIGN_SPEC",
    title: "Spesifikasi Desain",
    contentMd: markdown,
    upstreamManifest: { upstream },
  });
  return { documentId: dto.id, versionNo: dto.currentVersionNo ?? 1 };
}
