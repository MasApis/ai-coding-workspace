import { inArray } from "drizzle-orm";
import {
  PLANNING_STEP_TYPES,
  type DocumentType,
  type ProjectNextAction,
  type ProjectSummaryDto,
} from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { documentVersions, documents, exports, tasks } from "../db/schema.js";

export interface SummaryDocumentInput {
  type: DocumentType;
  approvalState: "draft" | "reviewed" | "approved";
  hasContent: boolean;
  stale: boolean;
}

export interface SummaryInput {
  documents: SummaryDocumentInput[];
  tasks: { total: number; done: number };
  lastExportAt: string | null;
}

// Stage is the first planning step that is not both approved and current.
// A project is "ready" only when every step is approved and no upstream
// document changed after approval.
export function summarizeProject(input: SummaryInput): ProjectSummaryDto {
  const byType = new Map(input.documents.map((doc) => [doc.type, doc]));

  let stage: ProjectSummaryDto["stage"] = "ready";
  let nextAction: ProjectNextAction = { kind: "export", documentType: null };

  for (const step of PLANNING_STEP_TYPES) {
    const doc = byType.get(step);
    const settled = doc !== undefined && doc.approvalState === "approved" && !doc.stale;
    if (settled) continue;

    stage = step;
    if (!doc) {
      nextAction = { kind: "create-document", documentType: step };
    } else if (!doc.hasContent) {
      nextAction = { kind: "write-document", documentType: step };
    } else if (doc.stale) {
      nextAction = { kind: "refresh-document", documentType: step };
    } else if (doc.approvalState === "draft") {
      nextAction = { kind: "review-document", documentType: step };
    } else {
      nextAction = { kind: "approve-document", documentType: step };
    }
    break;
  }

  return {
    stage,
    nextAction,
    documents: {
      total: input.documents.length,
      approved: input.documents.filter((doc) => doc.approvalState === "approved").length,
      stale: input.documents.filter((doc) => doc.stale).length,
    },
    tasks: input.tasks,
    lastExportAt: input.lastExportAt,
  };
}

interface Manifest {
  upstream: Array<{ documentId: string; versionNo: number }>;
}

function parseManifest(raw: string | null): Manifest | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Manifest;
    return Array.isArray(parsed.upstream) ? parsed : null;
  } catch {
    return null;
  }
}

type DocumentRow = typeof documents.$inferSelect;

// Staleness is evaluated in one pass over the project's documents instead of
// one query per dependency, so listing projects stays O(documents).
function staleIds(rows: DocumentRow[], versionNoByDoc: Map<string, number | null>): Set<string> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const stale = new Set<string>();
  for (const row of rows) {
    const manifest = parseManifest(row.upstreamManifestJson);
    if (!manifest) continue;
    for (const dep of manifest.upstream) {
      if (!byId.has(dep.documentId) || versionNoByDoc.get(dep.documentId) !== dep.versionNo) {
        stale.add(row.id);
        break;
      }
    }
  }
  return stale;
}

export async function loadProjectSummaries(db: AppDatabase, projectIds: string[]): Promise<Map<string, ProjectSummaryDto>> {
  const summaries = new Map<string, ProjectSummaryDto>();
  if (projectIds.length === 0) return summaries;

  const docRows = await db.select().from(documents).where(inArray(documents.projectId, projectIds)).all();
  const docIds = docRows.map((row) => row.id);

  const versionRows = docIds.length
    ? await db
        .select({ id: documentVersions.id, documentId: documentVersions.documentId, versionNo: documentVersions.versionNo })
        .from(documentVersions)
        .where(inArray(documentVersions.documentId, docIds))
        .all()
    : [];

  const versionNoById = new Map(versionRows.map((row) => [row.id, row.versionNo]));
  const versionNoByDoc = new Map<string, number | null>(
    docRows.map((row) => [row.id, row.currentVersionId ? (versionNoById.get(row.currentVersionId) ?? null) : null]),
  );
  const stale = staleIds(docRows, versionNoByDoc);

  const exportRows = await db
    .select({ projectId: exports.projectId, createdAt: exports.createdAt })
    .from(exports)
    .where(inArray(exports.projectId, projectIds))
    .all();
  const lastExport = new Map<string, number>();
  for (const row of exportRows) {
    const at = row.createdAt.getTime();
    if (at > (lastExport.get(row.projectId) ?? 0)) lastExport.set(row.projectId, at);
  }

  const taskRows = await db
    .select({ projectId: tasks.projectId, state: tasks.state })
    .from(tasks)
    .where(inArray(tasks.projectId, projectIds))
    .all();

  for (const projectId of projectIds) {
    const projectDocs = docRows.filter((row) => row.projectId === projectId);
    const projectTasks = taskRows.filter((row) => row.projectId === projectId);
    const exportedAt = lastExport.get(projectId);
    summaries.set(
      projectId,
      summarizeProject({
        documents: projectDocs.map((row) => ({
          type: row.type as DocumentType,
          approvalState: row.approvalState as SummaryDocumentInput["approvalState"],
          hasContent: row.currentVersionId !== null,
          stale: stale.has(row.id),
        })),
        tasks: {
          total: projectTasks.length,
          // Task states are not owned by any service yet; accept the two
          // spellings used by handoff exports so the count stays honest.
          done: projectTasks.filter((row) => row.state === "done" || row.state === "completed").length,
        },
        lastExportAt: exportedAt === undefined ? null : new Date(exportedAt).toISOString(),
      }),
    );
  }

  return summaries;
}
