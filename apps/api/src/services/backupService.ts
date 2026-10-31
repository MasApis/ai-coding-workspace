import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { BackupFile, ImportResult } from "@workspace/shared";
import { BACKUP_VERSION } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import {
  aiPreferences,
  conversations,
  decisions,
  designVersions,
  documentVersions,
  documents,
  projects,
  tasks,
} from "../db/schema.js";
import { HttpError } from "../http/errors.js";
import { getProject } from "./projectService.js";
import { createConversation, createMessage, listMessages } from "./conversationService.js";
import { listProviders } from "./providerService.js";

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new HttpError("VALIDATION_ERROR", "name must produce a non-empty slug");
  return slug;
}

export async function exportBackup(db: AppDatabase, projectId: string): Promise<BackupFile> {
  const project = await getProject(db, projectId);
  const docs = await db.select().from(documents).where(eq(documents.projectId, projectId)).all();

  const backupDocs = [];
  for (const doc of docs) {
    const versions = await db
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, doc.id))
      .all();
    let upstreamManifest: { upstream: Array<{ documentType: string; versionNo: number }> } | null = null;
    if (doc.upstreamManifestJson) {
      try {
        const parsed = JSON.parse(doc.upstreamManifestJson) as { upstream?: unknown };
        if (parsed && Array.isArray(parsed.upstream)) {
          upstreamManifest = { upstream: [] };
          for (const dep of parsed.upstream as Array<{ documentId?: string; versionNo?: number }>) {
            const depDoc = typeof dep.documentId === "string" ? await db.select().from(documents).where(eq(documents.id, dep.documentId)).get() : undefined;
            if (depDoc && typeof dep.versionNo === "number") {
              upstreamManifest.upstream.push({ documentType: depDoc.type, versionNo: dep.versionNo });
            }
          }
        }
      } catch {
        upstreamManifest = null;
      }
    }
    backupDocs.push({
      type: doc.type as "PRD",
      title: doc.title,
      approvalState: (doc.approvalState === "approved" || doc.approvalState === "reviewed" ? doc.approvalState : "draft") as "draft" | "reviewed" | "approved",
      upstreamManifest,
      versions: versions.map((v) => ({ versionNo: v.versionNo, contentMd: v.contentMd, origin: v.origin as "ai" | "user" | "import" })),
    });
  }

  const convRows = await db.select().from(conversations).where(eq(conversations.projectId, projectId)).all();
  const backupConvs = [];
  for (const conv of convRows) {
    const msgs = await listMessages(db, conv.id);
    backupConvs.push({
      title: conv.title,
      messages: msgs.map((m) => ({
        role: m.role,
        contentMd: m.contentMd,
        providerId: null,
        modelId: m.modelId,
        contextManifest: m.contextManifest as unknown,
      })),
    });
  }

  const prefRows = await db.select().from(aiPreferences).where(eq(aiPreferences.scopeType, "project")).all();
  const providers = await listProviders(db);
  const labelById = new Map(providers.map((p) => [p.id, p.label]));
  const backupPrefs = [];
  for (const pref of prefRows) {
    if (pref.scopeId !== projectId) continue;
    backupPrefs.push({ modelId: pref.modelId, providerLabel: labelById.get(pref.providerId) ?? null });
  }

  const designRows = await db.select().from(designVersions).where(eq(designVersions.projectId, projectId)).all();

  return {
    schemaVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    project: {
      name: project.name,
      slug: project.slug,
      description: project.description,
      ideaMd: project.ideaMd,
      state: project.state === "archived" ? "archived" : "active",
    },
    documents: backupDocs,
    decisions: (await db.select().from(decisions).where(eq(decisions.projectId, projectId)).all()).map((d) => ({
      question: d.question,
      answer: d.answer,
      rationale: d.rationale,
    })),
    tasks: (await db.select().from(tasks).where(eq(tasks.projectId, projectId)).all()).map((t) => ({
      ticketKey: t.ticketKey,
      title: t.title,
      descriptionMd: t.descriptionMd,
      priority: t.priority,
      state: t.state,
      dependencyKeysJson: t.dependencyKeysJson,
      acceptanceJson: t.acceptanceJson,
    })),
    conversations: backupConvs,
    preferences: backupPrefs,
    designVersions: designRows.map((d) => ({ versionNo: d.versionNo, specMd: d.specMd })),
  };
}

export async function importBackup(db: AppDatabase, backup: BackupFile): Promise<ImportResult> {
  const warnings: string[] = [];
  const baseSlug = slugify(backup.project.name);
  let slug = baseSlug;
  let attempt = 0;
  for (;;) {
    const taken = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug)).get();
    if (!taken) break;
    attempt += 1;
    slug = `${baseSlug}-import-${attempt}`;
  }

  const projectId = randomUUID();
  await db
    .insert(projects)
    .values({ id: projectId, name: backup.project.name, slug, description: backup.project.description, ideaMd: backup.project.ideaMd, state: backup.project.state })
    .run();

  let versionCount = 0;
  for (const doc of backup.documents) {
    const documentId = randomUUID();
    await db
      .insert(documents)
      .values({
        id: documentId,
        projectId,
        type: doc.type,
        title: doc.title,
        approvalState: doc.approvalState,
        upstreamManifestJson: doc.upstreamManifest ? JSON.stringify(doc.upstreamManifest) : null,
      })
      .run();
    const sorted = [...doc.versions].sort((a, b) => a.versionNo - b.versionNo);
    for (const v of sorted) {
      const versionId = randomUUID();
      await db
        .insert(documentVersions)
        .values({ id: versionId, documentId, versionNo: v.versionNo, contentMd: v.contentMd, origin: v.origin })
        .run();
      versionCount += 1;
      if (v.versionNo === sorted[sorted.length - 1]?.versionNo) {
        await db.update(documents).set({ currentVersionId: versionId }).where(eq(documents.id, documentId)).run();
      }
    }
    if (doc.approvalState === "approved") {
      warnings.push(`document ${doc.type} imported without approval binding; review and approve again`);
      await db.update(documents).set({ approvalState: "draft" }).where(eq(documents.id, documentId)).run();
    }
  }

  for (const d of backup.decisions) {
    await db.insert(decisions).values({ id: randomUUID(), projectId, question: d.question, answer: d.answer, rationale: d.rationale }).run();
  }
  for (const t of backup.tasks) {
    await db
      .insert(tasks)
      .values({
        id: randomUUID(),
        projectId,
        ticketKey: t.ticketKey,
        title: t.title,
        descriptionMd: t.descriptionMd,
        priority: t.priority,
        state: t.state,
        dependencyKeysJson: t.dependencyKeysJson,
        acceptanceJson: t.acceptanceJson,
      })
      .run();
  }

  let messageCount = 0;
  for (const conv of backup.conversations) {
    const created = await createConversation(db, { projectId, title: conv.title ?? undefined });
    for (const m of conv.messages) {
      await createMessage(db, created.id, {
        role: m.role,
        contentMd: m.contentMd,
        modelId: m.modelId ?? undefined,
        contextManifest: undefined,
      });
      messageCount += 1;
    }
  }

  const providers = await listProviders(db);
  const idByLabel = new Map(providers.map((p) => [p.label, p.id] as const));
  for (const pref of backup.preferences) {
    const providerId = pref.providerLabel ? idByLabel.get(pref.providerLabel) : undefined;
    if (!providerId) {
      warnings.push(`preference for model ${pref.modelId} skipped: no provider named ${pref.providerLabel ?? "(unknown)"}`);
      continue;
    }
    const existing = await db.select().from(aiPreferences).where(eq(aiPreferences.scopeId, projectId)).get();
    if (existing) {
      await db.update(aiPreferences).set({ providerId, modelId: pref.modelId }).where(eq(aiPreferences.id, existing.id)).run();
    } else {
      await db.insert(aiPreferences).values({ id: randomUUID(), scopeType: "project", scopeId: projectId, providerId, modelId: pref.modelId }).run();
    }
  }

  for (const dv of backup.designVersions) {
    await db.insert(designVersions).values({ id: randomUUID(), projectId, versionNo: dv.versionNo, specMd: dv.specMd, prototypePath: null }).run();
  }
  if (backup.designVersions.length > 0) {
    warnings.push("design prototype files are not included in backups");
  }
  warnings.push("export files are not included in backups");

  const counts = {
    documents: backup.documents.length,
    versions: versionCount,
    decisions: backup.decisions.length,
    tasks: backup.tasks.length,
    conversations: backup.conversations.length,
    messages: messageCount,
  };
  return { projectId, projectSlug: slug, counts, warnings };
}
