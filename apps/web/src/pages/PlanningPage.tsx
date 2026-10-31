import { useEffect, useState } from "react";
import { useBlocker, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "../components/Alert.js";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { Skeleton } from "../components/Skeleton.js";
import { AIPanel } from "../components/planning/AIPanel.js";
import { EditorPane } from "../components/planning/EditorPane.js";
import { StepsList } from "../components/planning/StepsList.js";
import { slugToType, DOCUMENT_LABELS } from "../lib/documentTypes.js";
import { ApiError } from "../lib/api.js";
import { approveDocument, createDocument, createVersion, friendlyDocumentError, listDocuments, listVersions, reviewDocument } from "../lib/documents.js";

export function PlanningPage() {
  const { projectId, documentType } = useParams();
  const queryClient = useQueryClient();
  const type = slugToType(documentType);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [content, setContent] = useState("");
  const [baseContent, setBaseContent] = useState("");
  const [viewingVersionNo, setViewingVersionNo] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<"steps" | "editor" | "ai">("editor");
  const [approveOpen, setApproveOpen] = useState(false);

  const docsQuery = useQuery({ queryKey: ["documents", projectId], queryFn: () => listDocuments(projectId ?? ""), enabled: !!projectId });
  const docs = docsQuery.data ?? [];
  const doc = docs.find((d) => d.type === type) ?? null;

  const versionsQuery = useQuery({
    queryKey: ["versions", doc?.id],
    queryFn: () => listVersions(doc?.id ?? ""),
    enabled: !!doc,
  });
  const versions = versionsQuery.data ?? [];

  useEffect(() => {
    setViewingVersionNo(null);
    setContent(doc?.contentMd ?? "");
    setBaseContent(doc?.contentMd ?? "");
  }, [doc?.id, doc?.contentMd]);

  useEffect(() => {
    if (viewingVersionNo === null) {
      setContent(doc?.contentMd ?? "");
      setBaseContent(doc?.contentMd ?? "");
    } else {
      const version = versions.find((v) => v.versionNo === viewingVersionNo);
      setContent(version?.contentMd ?? "");
      setBaseContent(version?.contentMd ?? "");
    }
  }, [viewingVersionNo, doc?.contentMd, versions]);

  const dirty = content !== baseContent;
  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ["documents", projectId] });
    await queryClient.invalidateQueries({ queryKey: ["versions"] });
  }

  const saveMutation = useMutation({
    mutationFn: (fromApproved: boolean) => {
      if (!doc || !projectId) throw new Error("no document");
      return createVersion(doc.id, { contentMd: content, fromApproved });
    },
    onSuccess: () => void refresh(),
  });
  const [saveError, setSaveError] = useState<string | null>(null);

  const reviewMutation = useMutation({
    mutationFn: () => {
      if (!doc) throw new Error("no document");
      return reviewDocument(doc.id);
    },
    onSuccess: () => void refresh(),
  });

  const approveMutation = useMutation({
    mutationFn: () => {
      if (!doc) throw new Error("no document");
      return approveDocument(doc.id);
    },
    onSuccess: () => {
      setApproveOpen(false);
      void refresh();
    },
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!projectId || !type) throw new Error("no target");
      return createDocument(projectId, { type, title: type, contentMd: "" });
    },
    onSuccess: () => void refresh(),
  });

  async function handleSave(fromApproved: boolean): Promise<void> {
    setSaveError(null);
    try {
      await saveMutation.mutateAsync(fromApproved);
    } catch (err) {
      setSaveError(friendlyDocumentError(err));
    }
  }

  if (!type || !projectId) {
    return (
      <Alert variant="error" title="Dokumen tidak dikenal">
        Kembali ke tab Dokumen dan pilih langkah yang tersedia.
      </Alert>
    );
  }

  return (
    <div>
      <div className="mb-4 flex gap-1 md:hidden" role="tablist" aria-label="Panel perencana">
        {(["steps", "editor", "ai"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={mobileTab === tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 rounded-control px-3 py-2 text-sm ${mobileTab === tab ? "bg-accent-soft font-medium text-accent" : "bg-surface text-ink-soft"}`}
          >
            {tab === "steps" ? "Langkah" : tab === "editor" ? "Editor" : "AI"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_300px]">
        <div className={mobileTab === "steps" ? "" : "hidden md:block"}>
          {docsQuery.isPending ? <Skeleton label="Memuat langkah…" /> : <StepsList projectId={projectId} docs={docs} selected={type} />}
        </div>

        <div className={mobileTab === "editor" ? "" : "hidden md:block"}>
          {docsQuery.isPending && <Skeleton label="Memuat dokumen…" />}
          {docsQuery.isError && (
            <Alert variant="error" title="Dokumen tidak dapat dimuat">
              Pastikan server API berjalan.
            </Alert>
          )}
          {!docsQuery.isPending && !docsQuery.isError && !doc && (
            <div className="flex flex-col gap-3">
              <Alert variant="empty" title={`${DOCUMENT_LABELS[type]} belum ada`}>
                Buat dokumen kosong lalu tulis manual, atau generate dengan AI.
              </Alert>
              <div>
                <Button variant="secondary" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Membuat…" : "Buat kosong"}
                </Button>
              </div>
            </div>
          )}
          {doc && (
            <EditorPane
              doc={doc}
              versions={versions}
              viewingVersionNo={viewingVersionNo}
              content={content}
              dirty={dirty}
              view={view}
              saving={saveMutation.isPending}
              saveError={saveError ?? (saveMutation.error ? friendlyDocumentError(saveMutation.error) : null)}
              onContent={setContent}
              onView={setView}
              onSelectVersion={setViewingVersionNo}
              onSave={(fromApproved) => void handleSave(fromApproved)}
              onReview={() => reviewMutation.mutate()}
              onApproveRequest={() => setApproveOpen(true)}
            />
          )}
        </div>

        <div className={mobileTab === "ai" ? "" : "hidden xl:block"}>
          <AIPanel projectId={projectId} docType={type} hasDoc={!!doc} approved={doc?.approvalState === "approved"} onGenerated={() => void refresh()} />
        </div>
      </div>

      <Dialog
        open={approveOpen}
        title="Setujui dokumen?"
        onClose={() => setApproveOpen(false)}
        confirmLabel={approveMutation.isPending ? "Menyetujui…" : "Ya, setujui"}
        confirmDisabled={approveMutation.isPending}
        onConfirm={() => approveMutation.mutate()}
      >
        <p>Versi terkini akan dikunci sebagai approved. Perubahan berikutnya memerlukan draf baru yang eksplisit.</p>
        {approveMutation.error && (
          <p role="alert" className="mt-2 text-sm text-error">
            {approveMutation.error instanceof ApiError ? friendlyDocumentError(approveMutation.error) : "Persetujuan gagal."}
          </p>
        )}
      </Dialog>

      <Dialog
        open={blocker.state === "blocked"}
        title="Buang perubahan?"
        onClose={() => blocker.reset?.()}
        confirmLabel="Ya, buang"
        destructive
        onConfirm={() => blocker.proceed?.()}
      >
        <p>Ada perubahan yang belum disimpan. Pindah halaman akan menghilangkannya.</p>
      </Dialog>
    </div>
  );
}
