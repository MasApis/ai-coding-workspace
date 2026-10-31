import { useState } from "react";
import { useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExportDto, ExportManifest } from "@workspace/shared";
import { Alert } from "../components/Alert.js";
import { Badge } from "../components/Badge.js";
import { Button, buttonClasses } from "../components/Button.js";
import { Skeleton } from "../components/Skeleton.js";
import { ApiError } from "../lib/api.js";
import { listDocuments } from "../lib/documents.js";
import { createExport, downloadUrl } from "../lib/exports.js";

export function ExportsPage() {
  const { projectId } = useParams();
  const queryClient = useQueryClient();
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [lastExport, setLastExport] = useState<ExportDto | null>(null);

  const docsQuery = useQuery({ queryKey: ["documents", projectId], queryFn: () => listDocuments(projectId ?? ""), enabled: !!projectId });
  const docs = docsQuery.data ?? [];
  const approved = docs.filter((d) => d.approvalState === "approved");
  const pending = docs.filter((d) => d.approvalState !== "approved");

  const exportMutation = useMutation({
    mutationFn: () => {
      if (!projectId) throw new Error("no project");
      return createExport(projectId, includeDrafts);
    },
    onSuccess: (dto) => {
      setLastExport(dto);
      void queryClient.invalidateQueries({ queryKey: ["documents", projectId] });
    },
  });

  const manifest: ExportManifest | null = lastExport ? (JSON.parse(lastExport.manifestJson) as ExportManifest) : null;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Ekspor</h2>
        <p className="mt-1 text-sm text-ink-soft">Paket ZIP dan serah terima OpenCode.</p>
      </div>

      {docsQuery.isPending && <Skeleton label="Memuat dokumen…" />}
      {docsQuery.isError && <Alert variant="error" title="Dokumen tidak dapat dimuat">Pastikan server API berjalan.</Alert>}

      {!docsQuery.isPending && !docsQuery.isError && (
        <div className="flex flex-col gap-4">
          <section aria-label="Pratinjau isi" className="rounded-card border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">Yang akan diekspor</h2>
            {approved.length === 0 && pending.length === 0 && (
              <p className="mt-2 text-sm text-ink-soft">Belum ada dokumen. Buat dan setujui dokumen dulu di Perencanaan.</p>
            )}
            <ul className="mt-2 flex flex-col gap-1">
              {approved.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="success">Disetujui</Badge>
                  <span>{d.title}</span>
                  <span className="text-xs text-ink-soft">v{d.currentVersionNo}</span>
                </li>
              ))}
              {pending.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-sm text-ink-soft">
                  <Badge variant="neutral">{d.approvalState === "reviewed" ? "Direview" : "Draf"}</Badge>
                  <span>{d.title} (hanya bila draf diikutkan)</span>
                </li>
              ))}
            </ul>
            <label className="mt-3 flex min-h-0 items-center gap-2 text-sm">
              <input type="checkbox" checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} className="h-5 w-5 accent-[#4F46E5]" />
              Sertakan draf yang belum disetujui
            </label>
          </section>

          {exportMutation.error && (
            <Alert variant="error" title="Ekspor gagal">
              {exportMutation.error instanceof ApiError ? exportMutation.error.message : "Terjadi kesalahan."}
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending || (approved.length === 0 && !includeDrafts)}
            >
              {exportMutation.isPending ? "Membuat ZIP…" : "Buat paket ZIP"}
            </Button>
            {lastExport && (
              <a href={downloadUrl(lastExport.id)} download className={buttonClasses("secondary")}>
                Unduh ZIP
              </a>
            )}
          </div>

          {manifest && (
            <section aria-label="Manifest" className="rounded-card border border-line bg-surface p-4">
              <h2 className="text-sm font-semibold">Manifest terakhir</h2>
              <p className="mt-1 font-mono text-xs break-all">{lastExport?.relativeFilePath}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {manifest.docs.map((d) => (
                  <li key={d.type} className="font-mono text-xs break-all">
                    {d.type} v{d.versionNo} [{d.status}] {d.sha256.slice(0, 12)}…
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Instruksi handoff" className="rounded-card border border-line bg-surface p-4 text-sm">
            <h2 className="text-sm font-semibold">Serah terima ke OpenCode</h2>
            <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5">
              <li>Unduh ZIP lalu unzip ke folder kerja: <code className="rounded bg-canvas px-1 font-mono text-[13px]">unzip &lt;file&gt;.zip -d kerja-saya</code></li>
              <li>Jalankan OpenCode di folder tersebut: <code className="rounded bg-canvas px-1 font-mono text-[13px]">opencode</code></li>
              <li>Minta implementasi awal, misal: <code className="rounded bg-canvas px-1 font-mono text-[13px]">opencode run "Implementasikan sesuai PRD.md dan TECHNICAL_SPEC.md"</code></li>
            </ol>
          </section>
        </div>
      )}

    </div>
  );
}
