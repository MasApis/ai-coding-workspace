import { PLANNING_STEP_TYPES, type DocumentType } from "@workspace/shared";

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  PROJECT_BRIEF: "Brief",
  PRD: "PRD",
  USER_FLOW: "Alur Pengguna",
  TECHNICAL_SPEC: "Spesifikasi Teknis",
  TEST_PLAN: "Rencana Uji",
  TASKS: "Dokumen Tugas",
  AGENTS: "AGENTS",
  DESIGN_SPEC: "Spesifikasi Desain",
};

export function typeToSlug(type: DocumentType): string {
  return type.toLowerCase().replace(/_/g, "-");
}

const SLUG_TO_TYPE: Record<string, DocumentType> = Object.fromEntries(
  PLANNING_STEP_TYPES.map((type) => [typeToSlug(type), type]),
) as Record<string, DocumentType>;

export function slugToType(slug: string | undefined): DocumentType | null {
  if (!slug) return null;
  if (slug === "brief") return "PROJECT_BRIEF";
  return SLUG_TO_TYPE[slug] ?? null;
}
