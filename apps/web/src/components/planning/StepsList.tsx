import { Link } from "react-router";
import type { DocumentDto, DocumentType } from "@workspace/shared";
import { Alert } from "../Alert.js";
import { Badge } from "../Badge.js";

export const PLAN_STEPS: Array<{ type: DocumentType; label: string }> = [
  { type: "PROJECT_BRIEF", label: "Brief" },
  { type: "PRD", label: "PRD" },
  { type: "USER_FLOW", label: "Alur Pengguna" },
  { type: "TECHNICAL_SPEC", label: "Spesifikasi Teknis" },
  { type: "TEST_PLAN", label: "Rencana Uji" },
  { type: "TASKS", label: "Tugas & AGENTS" },
  { type: "AGENTS", label: "AGENTS" },
];

export function typeToSlug(type: DocumentType): string {
  return type.toLowerCase().replace(/_/g, "-");
}

const SLUG_TO_TYPE: Record<string, DocumentType> = Object.fromEntries(
  PLAN_STEPS.map((s) => [typeToSlug(s.type), s.type]),
) as Record<string, DocumentType>;

export function slugToType(slug: string | undefined): DocumentType | null {
  if (!slug) return null;
  if (slug === "brief") return "PROJECT_BRIEF";
  return SLUG_TO_TYPE[slug] ?? null;
}

function statusBadge(doc: DocumentDto | undefined) {
  if (!doc) return <Badge variant="neutral">Belum ada</Badge>;
  if (doc.stale) return <Badge variant="warning">Usang</Badge>;
  if (doc.approvalState === "approved") return <Badge variant="success">Disetujui</Badge>;
  if (doc.approvalState === "reviewed") return <Badge variant="accent">Direview</Badge>;
  return <Badge>Draf</Badge>;
}

export function StepsList({
  projectId,
  docs,
  selected,
}: {
  projectId: string;
  docs: DocumentDto[];
  selected: string;
}) {
  return (
    <nav aria-label="Langkah perencanaan" className="flex flex-col gap-1">
      {PLAN_STEPS.map((step) => {
        const doc = docs.find((d) => d.type === step.type);
        const active = step.type === selected;
        return (
          <Link
            key={step.type}
            to={`/projects/${projectId}/planning/${typeToSlug(step.type)}`}
            aria-current={active ? "page" : undefined}
            className={`flex items-center justify-between gap-2 rounded-control px-3 py-2 text-sm ${
              active ? "bg-accent-soft font-medium text-accent" : "text-ink hover:bg-canvas"
            }`}
          >
            <span>{step.label}</span>
            {statusBadge(doc)}
          </Link>
        );
      })}
      {docs.length === 0 && (
        <Alert variant="empty" title="Belum ada dokumen">
          Buat kosong atau generate dengan AI.
        </Alert>
      )}
    </nav>
  );
}
