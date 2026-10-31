import { Link } from "react-router";
import type { DocumentDto } from "@workspace/shared";
import { Badge } from "../Badge.js";
import { DOCUMENT_LABELS, typeToSlug } from "../../lib/documentTypes.js";

export const PLAN_STEPS = [
  { type: "PROJECT_BRIEF", label: DOCUMENT_LABELS.PROJECT_BRIEF },
  { type: "PRD", label: DOCUMENT_LABELS.PRD },
  { type: "USER_FLOW", label: DOCUMENT_LABELS.USER_FLOW },
  { type: "TECHNICAL_SPEC", label: DOCUMENT_LABELS.TECHNICAL_SPEC },
  { type: "TEST_PLAN", label: DOCUMENT_LABELS.TEST_PLAN },
  { type: "TASKS", label: DOCUMENT_LABELS.TASKS },
  { type: "AGENTS", label: DOCUMENT_LABELS.AGENTS },
] as const;

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
            className={`flex min-h-11 items-center justify-between gap-2 rounded-control px-3 py-2 text-sm ${
              active ? "bg-accent-soft font-medium text-accent" : "text-ink hover:bg-canvas"
            }`}
          >
            <span>{step.label}</span>
            {statusBadge(doc)}
          </Link>
        );
      })}
    </nav>
  );
}
