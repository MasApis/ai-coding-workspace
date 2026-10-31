import type { ProjectNextAction, ProjectStage } from "@workspace/shared";
import { DOCUMENT_LABELS, typeToSlug } from "./documentTypes.js";

export type StageTone = "success" | "warning" | "neutral";

export function stageLabel(stage: ProjectStage): string {
  return stage === "ready" ? "Siap diekspor" : DOCUMENT_LABELS[stage];
}

// Tone describes the project state, never a connection: green means every
// planning step is approved and current, amber means something went stale.
export function stageTone(stage: ProjectStage, stale: boolean): StageTone {
  if (stage === "ready") return "success";
  return stale ? "warning" : "neutral";
}

export function nextActionLabel(action: ProjectNextAction): string {
  const doc = action.documentType ? DOCUMENT_LABELS[action.documentType] : "";
  switch (action.kind) {
    case "create-document":
      return `Mulai ${doc}`;
    case "write-document":
      return `Tulis ${doc}`;
    case "review-document":
      return `Review ${doc}`;
    case "approve-document":
      return `Setujui ${doc}`;
    case "refresh-document":
      return `Perbarui ${doc}`;
    case "export":
      return "Ekspor paket ZIP";
  }
}

export function nextActionHref(projectId: string, action: ProjectNextAction): string {
  if (!action.documentType) return `/projects/${projectId}/exports`;
  return `/projects/${projectId}/planning/${typeToSlug(action.documentType)}`;
}
