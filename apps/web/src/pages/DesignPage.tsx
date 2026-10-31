import { useId, useRef, useState } from "react";
import { useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "../components/Alert.js";
import { Badge } from "../components/Badge.js";
import { Button, buttonClasses } from "../components/Button.js";
import { Skeleton } from "../components/Skeleton.js";
import { Markdown } from "../components/Markdown.js";
import { TabList, tabPanelProps } from "../components/Tabs.js";
import { fetchPrototypeHtml, friendlyDesignError, generateDesignStream, generatePrototype, getLatestPrototype, parseDesignSections, prototypeDownloadUrl } from "../lib/design.js";
import { listDocuments } from "../lib/documents.js";
import { ApiError } from "../lib/api.js";

const TABS = [
  { id: "brief", label: "Brief", sections: ["Brief Desain"] },
  { id: "sitemap", label: "Sitemap", sections: ["Peta Situs"] },
  { id: "screens", label: "Layar", sections: ["Layar", "Komponen"] },
  { id: "tokens", label: "Token", sections: ["Token Desain"] },
  { id: "preview", label: "Pratinjau", sections: [] },
  { id: "prototype", label: "Prototipe", sections: [] },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function DesignPage() {
  const { projectId } = useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>("brief");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [protoHtml, setProtoHtml] = useState<string | null>(null);
  const [protoVersion, setProtoVersion] = useState<number | null>(null);
  const [protoError, setProtoError] = useState<string | null>(null);
  const [protoLoading, setProtoLoading] = useState(false);
  const panelId = useId();
  const abortRef = useRef<AbortController | null>(null);

  const docsQuery = useQuery({ queryKey: ["documents", projectId], queryFn: () => listDocuments(projectId ?? ""), enabled: !!projectId });
  const docs = docsQuery.data ?? [];
  const design = docs.find((d) => d.type === "DESIGN_SPEC") ?? null;
  const sections = design?.contentMd ? parseDesignSections(design.contentMd) : new Map<string, string>();

  async function handlePrototype(regenerate: boolean): Promise<void> {
    if (!projectId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setProtoLoading(true);
    setProtoError(null);
    try {
      if (regenerate) {
        await generatePrototype(projectId);
      }
      const latest = await getLatestPrototype(projectId);
      setProtoVersion(latest.versionNo);
      if (!controller.signal.aborted) {
        setProtoHtml(await fetchPrototypeHtml(projectId, controller.signal));
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setProtoError(err instanceof Error ? friendlyDesignError(err) : "Prototipe gagal dimuat.");
      }
    } finally {
      setProtoLoading(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

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
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Desain Studio</h2>
        <p className="mt-1 text-sm text-ink-soft">Brief, sitemap, layar, token, dan pratinjau dokumen.</p>
      </div>

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
              <TabList
                label="Bagian desain"
                items={TABS.map((t) => ({ id: t.id, label: t.label }))}
                value={tab}
                onChange={setTab}
                panelId={panelId}
                className="flex flex-wrap gap-1"
              />

              <div {...tabPanelProps(panelId, tab)} className="rounded-card border border-line bg-surface p-4">
                {tab === "preview" ? (
                  <Markdown source={design.contentMd ?? ""} label="Pratinjau spesifikasi desain" />
                ) : tab === "prototype" ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={() => void handlePrototype(false)} disabled={protoLoading || !design}>
                        {protoLoading ? "Memuat…" : "Tampilkan prototipe"}
                      </Button>
                      <Button variant="secondary" onClick={() => void handlePrototype(true)} disabled={protoLoading || !design}>
                        Generate ulang
                      </Button>
                      {protoVersion !== null && <Badge variant="accent">v{protoVersion}</Badge>}
                      {projectId && (
                        <a
                          href={prototypeDownloadUrl(projectId)}
                          download
                          className={buttonClasses("secondary")}
                        >
                          Unduh index.html
                        </a>
                      )}
                    </div>
                    {protoError && (
                      <Alert variant="error" title="Prototipe gagal">
                        {protoError}
                      </Alert>
                    )}
                    {protoHtml !== null && (
                      <iframe
                        title="Pratinjau prototipe (sandbox)"
                        sandbox=""
                        srcDoc={protoHtml}
                        className="h-[480px] w-full rounded-control border border-line bg-white"
                      />
                    )}
                    <p className="text-xs text-ink-soft">
                      Dijalankan terisolasi tanpa skrip dan tanpa akses origin aplikasi.
                    </p>
                  </div>
                ) : tabSections.length === 0 ? (
                  <p className="text-sm text-ink-soft">
                    Bagian ini kosong. Dokumen mungkin ditulis manual tanpa heading standar — generate ulang untuk struktur baku.
                  </p>
                ) : (
                  tabSections.map((s) => (
                    <article key={s.heading} className="mb-4">
                      <h3 className="text-sm font-semibold">{s.heading}</h3>
                      <Markdown source={s.body} className="mt-1 [&_p]:my-1" />
                    </article>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
