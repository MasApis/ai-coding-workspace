import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext } from "react-router";
import type { ProjectNextActionKind } from "@workspace/shared";
import { Alert } from "../components/Alert.js";
import { Skeleton } from "../components/Skeleton.js";
import { StepsList } from "../components/planning/StepsList.js";
import type { ProjectOutletContext } from "../components/project/ProjectLayout.js";
import { listDocuments } from "../lib/documents.js";
import { formatDateTime } from "../lib/format.js";
import { nextActionLabel } from "../lib/projectStage.js";

const NEXT_ACTION_HINTS: Record<ProjectNextActionKind, string> = {
  "create-document": "Dokumen ini belum ada. Buat kosong lalu tulis manual, atau generate dengan AI.",
  "write-document": "Dokumen sudah dibuat tetapi belum punya isi.",
  "review-document": "Baca versi terbaru, lalu tandai sudah direview.",
  "approve-document": "Versi sudah direview. Setujui untuk mengunci dan lanjut ke langkah berikutnya.",
  "refresh-document": "Dokumen hulu berubah setelah versi ini disetujui, jadi isinya perlu diperbarui.",
  export: "Semua langkah sudah disetujui. Ekspor paket ZIP untuk mulai implementasi.",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold">{value}</dd>
    </div>
  );
}

export function ProjectOverviewPage() {
  const { project } = useOutletContext<ProjectOutletContext>();
  const summary = project.summary;
  const docsQuery = useQuery({ queryKey: ["documents", project.id], queryFn: () => listDocuments(project.id) });
  const docs = docsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="next-step-heading" className="rounded-card border border-line bg-surface p-4">
        <h2 id="next-step-heading" className="text-sm font-semibold text-ink-soft">
          Langkah berikutnya
        </h2>
        <p className="mt-1 text-lg font-semibold">{nextActionLabel(summary.nextAction)}</p>
        <p className="mt-1 text-sm text-ink-soft">{NEXT_ACTION_HINTS[summary.nextAction.kind]}</p>
      </section>

      {summary.documents.stale > 0 && (
        <Alert variant="warning" title={`${summary.documents.stale} dokumen usang`}>
          Dokumen hulu berubah setelah versi turunannya disetujui. Perbarui agar isinya tetap konsisten.
        </Alert>
      )}

      <section aria-labelledby="counts-heading">
        <h2 id="counts-heading" className="mb-2 text-sm font-semibold text-ink-soft">
          Isi proyek
        </h2>
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Dokumen disetujui" value={`${summary.documents.approved} dari ${summary.documents.total}`} />
          <Stat label="Dokumen usang" value={String(summary.documents.stale)} />
          <Stat label="Tugas selesai" value={`${summary.tasks.done} dari ${summary.tasks.total}`} />
          <Stat label="Ekspor terakhir" value={summary.lastExportAt ? formatDateTime(summary.lastExportAt) : "Belum pernah"} />
        </dl>
      </section>

      <section aria-labelledby="steps-heading">
        <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <h2 id="steps-heading" className="text-sm font-semibold text-ink-soft">
            Langkah perencanaan
          </h2>
          <Link to={`/projects/${project.id}/documents`} className="text-sm text-ink-soft hover:text-ink hover:underline">
            Lihat semua dokumen
          </Link>
        </div>
        {docsQuery.isPending && <Skeleton label="Memuat langkah…" />}
        {docsQuery.isError && (
          <Alert variant="error" title="Dokumen tidak dapat dimuat">
            Pastikan server API lokal berjalan, lalu muat ulang halaman.
          </Alert>
        )}
        {!docsQuery.isPending && !docsQuery.isError && <StepsList projectId={project.id} docs={docs} selected="" />}
      </section>
    </div>
  );
}
