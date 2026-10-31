import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type {
  CreateDocumentInput,
  CreateVersionInput,
  DocumentDto,
  DocumentType,
  DocumentVersionDto,
} from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { documentVersions, documents } from "../db/schema.js";
import { HttpError } from "../http/errors.js";
import { getProject } from "./projectService.js";

type DocumentRow = typeof documents.$inferSelect;

interface UpstreamManifest {
  upstream: Array<{ documentId: string; versionNo: number }>;
}

function parseManifest(raw: string | null): UpstreamManifest | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UpstreamManifest;
    if (!Array.isArray(parsed.upstream)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function currentVersionNo(db: AppDatabase, documentId: string): Promise<number | null> {
  const row = await db
    .select({ versionNo: documentVersions.versionNo })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.versionNo))
    .get();
  return row?.versionNo ?? null;
}

async function isStale(db: AppDatabase, row: DocumentRow): Promise<boolean> {
  const manifest = parseManifest(row.upstreamManifestJson);
  if (!manifest) return false;
  for (const dep of manifest.upstream) {
    const depDoc = await db.select().from(documents).where(eq(documents.id, dep.documentId)).get();
    if (!depDoc) return true;
    const latest = await currentVersionNo(db, dep.documentId);
    if (latest === null || latest !== dep.versionNo) return true;
  }
  return false;
}

async function toDto(db: AppDatabase, row: DocumentRow): Promise<DocumentDto> {
  const current = row.currentVersionId
    ? await db.select().from(documentVersions).where(eq(documentVersions.id, row.currentVersionId)).get()
    : undefined;
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type as DocumentType,
    title: row.title,
    approvalState: row.approvalState as DocumentDto["approvalState"],
    currentVersionId: row.currentVersionId,
    currentVersionNo: current?.versionNo ?? null,
    contentMd: current?.contentMd ?? null,
    stale: await isStale(db, row),
    approvedVersionId: row.approvedVersionId,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireDocument(db: AppDatabase, id: string): Promise<DocumentRow> {
  const row = await db.select().from(documents).where(eq(documents.id, id)).get();
  if (!row) throw new HttpError("DOCUMENT_NOT_FOUND", `document not found: ${id}`);
  return row;
}

export async function listDocuments(db: AppDatabase, projectId: string): Promise<DocumentDto[]> {
  await getProject(db, projectId);
  const rows = await db.select().from(documents).where(eq(documents.projectId, projectId)).all();
  return Promise.all(rows.map((r) => toDto(db, r)));
}

export async function createDocument(db: AppDatabase, projectId: string, input: CreateDocumentInput): Promise<DocumentDto> {
  await getProject(db, projectId);
  const taken = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.projectId, projectId), eq(documents.type, input.type)))
    .get();
  if (taken) throw new HttpError("DOCUMENT_TYPE_TAKEN", `document type already exists in project: ${input.type}`);

  const id = randomUUID();
  const versionId = randomUUID();
  await db.transaction((tx) => {
    tx.insert(documents)
      .values({
        id,
        projectId,
        type: input.type,
        title: input.title,
        upstreamManifestJson: input.upstreamManifest ? JSON.stringify(input.upstreamManifest) : null,
      })
      .run();
    tx.insert(documentVersions).values({ id: versionId, documentId: id, versionNo: 1, contentMd: input.contentMd, origin: "user" }).run();
    tx.update(documents).set({ currentVersionId: versionId }).where(eq(documents.id, id)).run();
  });
  return toDto(db, await requireDocument(db, id));
}

export async function getDocument(db: AppDatabase, id: string): Promise<DocumentDto> {
  return toDto(db, await requireDocument(db, id));
}

export async function createVersion(db: AppDatabase, id: string, input: CreateVersionInput): Promise<DocumentDto> {
  const row = await requireDocument(db, id);
  if (row.approvalState === "approved" && !input.fromApproved) {
    throw new HttpError("APPROVED_LOCKED", "document is approved; create a new draft from the approved version explicitly");
  }
  const latest = (await currentVersionNo(db, id)) ?? 0;
  const versionId = randomUUID();
  const nextState = row.approvalState === "approved" ? "draft" : row.approvalState === "reviewed" ? "draft" : row.approvalState;
  await db.transaction((tx) => {
    tx.insert(documentVersions)
      .values({ id: versionId, documentId: id, versionNo: latest + 1, contentMd: input.contentMd, origin: input.origin })
      .run();
    tx
      .update(documents)
      .set({
        currentVersionId: versionId,
        approvalState: nextState,
        ...(row.approvalState === "approved" ? { approvedVersionId: null, approvedAt: null } : {}),
      })
      .where(eq(documents.id, id))
      .run();
  });
  return toDto(db, await requireDocument(db, id));
}

export async function listVersions(db: AppDatabase, id: string): Promise<DocumentVersionDto[]> {
  await requireDocument(db, id);
  const rows = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, id))
    .orderBy(documentVersions.versionNo)
    .all();
  return rows.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    versionNo: r.versionNo,
    contentMd: r.contentMd,
    origin: r.origin as DocumentVersionDto["origin"],
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface ResolvedContextDoc {
  documentId: string;
  versionNo: number;
  type: string;
  title: string;
  contentMd: string;
}

export async function resolveContextDocs(
  db: AppDatabase,
  projectId: string,
  refs: Array<{ documentId: string; versionNo?: number }>,
): Promise<ResolvedContextDoc[]> {
  const resolved: ResolvedContextDoc[] = [];
  for (const ref of refs) {
    const doc = await db.select().from(documents).where(eq(documents.id, ref.documentId)).get();
    if (!doc || doc.projectId !== projectId) {
      throw new HttpError("DOCUMENT_NOT_FOUND", `document not found: ${ref.documentId}`);
    }
    if (ref.versionNo !== undefined) {
      const version = await db
        .select()
        .from(documentVersions)
        .where(and(eq(documentVersions.documentId, doc.id), eq(documentVersions.versionNo, ref.versionNo)))
        .get();
      if (!version) throw new HttpError("DOCUMENT_NOT_FOUND", `document version not found: ${ref.documentId} v${ref.versionNo}`);
      resolved.push({ documentId: doc.id, versionNo: version.versionNo, type: doc.type, title: doc.title, contentMd: version.contentMd });
    } else {
      const current = doc.currentVersionId
        ? await db.select().from(documentVersions).where(eq(documentVersions.id, doc.currentVersionId)).get()
        : undefined;
      if (!current) throw new HttpError("DOCUMENT_NOT_FOUND", `document has no content: ${doc.id}`);
      resolved.push({ documentId: doc.id, versionNo: current.versionNo, type: doc.type, title: doc.title, contentMd: current.contentMd });
    }
  }
  return resolved;
}

export async function reviewDocument(db: AppDatabase, id: string): Promise<DocumentDto> {
  const row = await requireDocument(db, id);
  if (row.approvalState !== "draft") {
    throw new HttpError("INVALID_STATE", "only draft documents can be marked reviewed");
  }
  await db.update(documents).set({ approvalState: "reviewed" }).where(eq(documents.id, id)).run();
  return toDto(db, await requireDocument(db, id));
}

export async function approveDocument(db: AppDatabase, id: string): Promise<DocumentDto> {
  const row = await requireDocument(db, id);
  if (row.approvalState === "approved") {
    throw new HttpError("INVALID_STATE", "document is already approved");
  }
  if (!row.currentVersionId) {
    throw new HttpError("INVALID_STATE", "document has no version to approve");
  }
  const now = new Date();
  await db.transaction((tx) => {
    tx.update(documents)
      .set({ approvalState: "approved", approvedVersionId: row.currentVersionId, approvedAt: now })
      .where(eq(documents.id, id))
      .run();
  });
  return toDto(db, await requireDocument(db, id));
}
