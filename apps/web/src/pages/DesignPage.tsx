import { useRef, useState } from "react";
import { useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "../components/Alert.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Skeleton } from "../components/Skeleton.js";
import { renderMarkdown } from "../lib/markdown.js";
import { friendlyDesignError, generateDesignStream, parseDesignSections } from "../lib/design.js";
import { listDocuments } from "../lib/documents.js";
import { ApiError } from "../lib/api.js";
import { BackToProjects, PageHeader } from "./PageBits.js";

const TABS = [
  { id: "brief", label: "Brief", sections: ["Brief Desain"] },
  { id: "sitemap", label: "Sitemap", sections: ["Peta Situs"] },
  { id: "screens", label: "Layar", sections: ["Layar", "Komponen"] },
  { id: "tokens", label: "Token", sections: ["Token Desain"] },
  { id: "preview", label: "Pratinjau", sections: [] },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function DesignPage() {
  const { projectId } = useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>("brief");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const docsQuery = useQuery({ queryKey: ["documents", projectId], queryFn: () => listDocuments(projectId ?? ""), enabled: !!projectId });
  const docs = docsQuery.data ?? [];
  const design = docs.find((d) => d.type === "DESIGN_SPEC") ?? null;
  const sections = design?.contentMd ? parseDesignSections(design.contentMd) : new Map<string, string>();

  async function handleGenerate(): Promise<void> {
    if (!projectId || generating) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setProgress(null);
    setError(null);
    try {
      await generateDesignStream(projectId, design?.approvalState === "approved", controller.signal, {
        onProgress: (e) => setProgress(`${e.section} (${e.done}/${e.total})`),
        onError: (code, message) => setError(friendlyDesignError(code === "UNKNOWN_ERROR" ? new Error(message) : new ApiError(400, code, message))),
        onDone: () => void queryClient.invalidateQueries({ queryKey: ["documents", projectId] }),
      });
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Pembuatan gagal.");
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0]!;
  const tabSections = activeTab.sections
    .map((heading) => ({ heading, body: sections.get(heading) }))
    .filter((s): s is { heading: string; body: string } => typeof s.body === "string" && s.body.length > 0);

  return (
    <div>
      <PageHeader title="Desain Studio" description="Brief, sitemap, layar, token, dan pratinjau dokumen." />

      {docsQuery.isPending && <Skeleton label="Memuat dokumen desain…" />}
      {docsQuery.isError && (
        <Alert variant="error" title="Dokumen tidak dapat dimuat">
          Pastikan server API berjalan.
        </Alert>
      )}

      {!docsQuery.isPending && !docsQuery.isError && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {design ? (
              <>
                {design.approvalState === "approved" && <Badge variant="success">Disetujui</Badge>}
                {design.approvalState === "reviewed" && <Badge variant="accent">Direview</Badge>}
                {design.approvalState === "draft" && <Badge>Draf v{design.currentVersionNo}</Badge>}
                {design.stale && <Badge variant="warning">Usang — PRD berubah</Badge>}
              </>
            ) : (
              <Badge variant="neutral">Belum ada spesifikasi desain</Badge>
            )}
            <div className="flex gap-2">
              <Button onClick={() => void handleGenerate()} disabled={generating}>
                {generating ? "Membuat…" : design ? "Generate ulang" : "Generate"}
              </Button>
              {generating && (
                <Button variant="secondary" onClick={() => abortRef.current?.abort()}>
                  Batalkan
                </Button>
              )}
            </div>
          </div>

          {progress && (
            <p role="status" className="text-sm text-ink-soft">
              {progress}
            </p>
          )}
          {error && (
            <Alert variant="error" title="Pembuatan gagal">
              {error}
            </Alert>
          )}

          {design && (
            <>
              <div role="tablist" aria-label="Bagian desain" className="flex flex-wrap gap-1">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`rounded-control px-3 py-2 text-sm ${tab === t.id ? "bg-accent-soft font-medium text-accent" : "hover:bg-canvas"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <section aria-label={activeTab.label} className="rounded-card border border-line bg-surface p-4">
                {tab === "preview" ? (
                  <div
                    className="max-w-none text-sm [&_code]:rounded [&_code]:bg-canvas [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(design.contentMd ?? "") }}
                  />
                ) : tabSections.length === 0 ? (
                  <p className="text-sm text-ink-soft">
                    Bagian ini kosong. Dokumen mungkin ditulis manual tanpa heading standar — generate ulang untuk struktur baku.
                  </p>
                ) : (
                  tabSections.map((s) => (
                    <article key={s.heading} className="mb-4">
                      <h3 className="text-sm font-semibold">{s.heading}</h3>
                      <div
                        className="mt-1 text-sm [&_li]:ml-4 [&_li]:list-disc [&_p]:my-1"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(s.body) }}
                      />
                    </article>
                  ))
                )}
              </section>
            </>
          )}
        </div>
      )}

      <div className="mt-6">
        <BackToProjects />
      </div>
    </div>
  );
}
