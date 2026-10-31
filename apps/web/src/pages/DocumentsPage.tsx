import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router";
import type { DocumentDto } from "@workspace/shared";
import { Alert } from "../components/Alert.js";
import { Badge } from "../components/Badge.js";
import { Skeleton } from "../components/Skeleton.js";
import type { ProjectOutletContext } from "../components/project/ProjectLayout.js";
import { DOCUMENT_LABELS, typeToSlug } from "../lib/documentTypes.js";
import { listDocuments } from "../lib/documents.js";
import { formatDateTime } from "../lib/format.js";
import { PLAN_STEPS } from "../components/planning/StepsList.js";

function statusBadge(doc: DocumentDto) {
  if (doc.stale) return <Badge variant="warning">Usang</Badge>;
  if (doc.approvalState === "approved") return <Badge variant="success">Disetujui</Badge>;
  if (doc.approvalState === "reviewed") return <Badge variant="accent">Direview</Badge>;
  return <Badge>Draf</Badge>;
}

// One row per planning step, whether or not the document exists: the page
// doubles as a checklist, so a missing step must stay visible.
export function DocumentsPage() {
  const { project } = useOutletContext<ProjectOutletContext>();
  const docsQuery = useQuery({ queryKey: ["documents", project.id], queryFn: () => listDocuments(project.id) });
  const docs = docsQuery.data ?? [];
  const byType = new Map(docs.map((doc) => [doc.type, doc]));
  const extra = docs.filter((doc) => !PLAN_STEPS.some((step) => step.type === doc.type));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Dokumen</h2>
          <p className="mt-1 text-sm text-ink-soft">Brief sampai AGENTS, beserta status dan versi terakhir.</p>
        </div>
      </div>

      {docsQuery.isPending && <Skeleton label="Memuat dokumen…" />}

      {docsQuery.isError && (
        <Alert variant="error" title="Dokumen tidak dapat dimuat">
          Pastikan server API lokal berjalan, lalu muat ulang halaman.
        </Alert>
      )}

      {!docsQuery.isPending && !docsQuery.isError && (
        <ul className="flex flex-col divide-y divide-line rounded-card border border-line bg-surface">
          {[...PLAN_STEPS, ...extra.map((doc) => ({ type: doc.type, label: DOCUMENT_LABELS[doc.type] }))].map((step) => {
            const doc = byType.get(step.type);
            return (
              <li key={step.type} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/projects/${project.id}/planning/${typeToSlug(step.type)}`}
                    className="font-medium text-ink hover:text-accent hover:underline"
                  >
                    {step.label}
                  </Link>
                  <p className="mt-1 text-xs text-ink-soft">
                    {doc
                      ? `Versi ${doc.currentVersionNo ?? "—"} · Diubah ${formatDateTime(doc.updatedAt)}`
                      : "Belum dibuat"}
                  </p>
                </div>
                {doc ? statusBadge(doc) : <Badge variant="neutral">Belum ada</Badge>}
                <Link
                  to={`/projects/${project.id}/planning/${typeToSlug(step.type)}`}
                  className="text-sm text-ink-soft hover:text-ink hover:underline"
                >
                  {doc ? "Buka" : "Buat"}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
