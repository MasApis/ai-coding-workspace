import { useEffect, useId, useRef, useState } from "react";
import type { DocumentDto, DocumentVersionDto } from "@workspace/shared";
import { Alert } from "../Alert.js";
import { EmptyState } from "../EmptyState.js";
import { Badge } from "../Badge.js";
import { Button } from "../Button.js";
import { Dialog } from "../Dialog.js";
import { Markdown } from "../Markdown.js";
import { Select } from "../TextField.js";
import { TabList, tabPanelProps } from "../Tabs.js";
import { DOCUMENT_LABELS, VERSION_ORIGIN_LABELS } from "../../lib/documentTypes.js";
import { countLines, countWords } from "../../lib/text.js";
import { diffLines, diffStats } from "../../lib/textDiff.js";

const VIEW_TABS = [
  { id: "edit", label: "Edit" },
  { id: "preview", label: "Pratinjau" },
] as const;

export function EditorPane({
  doc,
  versions,
  viewingVersionNo,
  content,
  baseContent,
  dirty,
  view,
  saving,
  saveError,
  onContent,
  onView,
  onSelectVersion,
  onSave,
  onReview,
  onApproveRequest,
}: {
  doc: DocumentDto | null;
  versions: DocumentVersionDto[];
  viewingVersionNo: number | null;
  content: string;
  baseContent: string;
  dirty: boolean;
  view: "edit" | "preview";
  saving: boolean;
  saveError: string | null;
  onContent: (value: string) => void;
  onView: (view: "edit" | "preview") => void;
  onSelectVersion: (versionNo: number | null) => void;
  onSave: (fromApproved: boolean) => void;
  onReview: () => void;
  onApproveRequest: () => void;
}) {
  const panelId = useId();
  const [reviewOpen, setReviewOpen] = useState(false);
  const diffRef = useRef<HTMLDivElement>(null);

  const rows = dirty ? diffLines(baseContent, content) : [];
  const stats = diffStats(rows);

  useEffect(() => {
    if (!reviewOpen) return;
    // Land on the first change instead of making the reader hunt for it.
    const firstChange = diffRef.current?.querySelector<HTMLElement>("[data-change='true']");
    firstChange?.scrollIntoView({ block: "center" });
  }, [reviewOpen]);

  if (!doc) {
    return (
      <EmptyState title="Dokumen belum ada">
        Buat kosong atau generate dengan AI dari panel samping.
      </EmptyState>
    );
  }

  const readOnly = viewingVersionNo !== null;
  const approved = doc.approvalState === "approved";
  // Older documents were created with the raw enum as their title; show the
  // human label instead of leaking storage values into the heading.
  const displayTitle = doc.title === doc.type ? (DOCUMENT_LABELS[doc.type] ?? doc.title) : doc.title;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{displayTitle}</h2>
        {doc.approvalState === "approved" && <Badge variant="success">Disetujui</Badge>}
        {doc.approvalState === "reviewed" && <Badge variant="accent">Direview</Badge>}
        {doc.approvalState === "draft" && <Badge>Draf v{doc.currentVersionNo}</Badge>}
        {doc.stale && <Badge variant="warning">Usang — dokumen hulu berubah</Badge>}
        {dirty && <span className="text-xs font-medium text-warning">Belum disimpan</span>}

        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button disabled={!dirty || readOnly || saving} onClick={() => setReviewOpen(true)}>
            {saving ? "Menyimpan…" : approved ? "Buat draf baru dari versi disetujui" : "Simpan versi baru"}
          </Button>
          {doc.approvalState === "draft" && (
            <Button variant="secondary" onClick={onReview}>
              Tandai direview
            </Button>
          )}
          {doc.approvalState !== "approved" && (
            <Button variant="secondary" onClick={onApproveRequest}>
              Setujui
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <TabList
          label="Mode editor"
          items={VIEW_TABS}
          value={view}
          onChange={onView}
          panelId={panelId}
          className="flex gap-1 rounded-control border border-line p-1"
          tabClassName={(active) => `rounded px-3 py-1 text-sm ${active ? "bg-accent-soft font-medium text-accent" : "text-ink-soft hover:bg-canvas"}`}
        />
        <Select
          label="Versi"
          value={viewingVersionNo === null ? "current" : String(viewingVersionNo)}
          onChange={(e) => onSelectVersion(e.target.value === "current" ? null : Number(e.target.value))}
        >
          <option value="current">Terkini (v{doc.currentVersionNo})</option>
          {versions.map((v) => (
            <option key={v.id} value={v.versionNo}>
              v{v.versionNo} — {VERSION_ORIGIN_LABELS[v.origin]}
            </option>
          ))}
        </Select>
        <p className="text-xs text-ink-soft" role="status">
          {countWords(content)} kata · {countLines(content)} baris
        </p>
      </div>

      {readOnly && (
        <Alert variant="info" title={`Melihat versi lama v${viewingVersionNo}`}>
          Versi lama tidak dapat diubah; menyimpan selalu membuat versi baru dari yang terkini.
        </Alert>
      )}

      <div {...tabPanelProps(panelId, view)}>
        {view === "edit" ? (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Isi Markdown</span>
            <textarea
              value={content}
              onChange={(e) => onContent(e.target.value)}
              disabled={readOnly}
              rows={18}
              className="w-full rounded-control border border-line bg-surface p-3 font-mono text-sm"
            />
          </label>
        ) : (
          <div className="rounded-control border border-line bg-surface p-4">
            <Markdown source={content} label="Pratinjau" />
          </div>
        )}
      </div>

      {saveError && (
        <Alert variant="error" title="Penyimpanan gagal">
          {saveError}
        </Alert>
      )}

      <Dialog
        open={reviewOpen}
        title="Tinjau perubahan"
        onClose={() => setReviewOpen(false)}
        confirmLabel={saving ? "Menyimpan…" : "Ya, simpan"}
        confirmDisabled={saving}
        onConfirm={() => {
          setReviewOpen(false);
          onSave(approved);
        }}
      >
        <p className="text-ink-soft">
          {stats.added} baris ditambah · {stats.removed} baris dihapus
          {approved ? " · versi yang disetujui saat ini tetap tersimpan" : ""}
        </p>
        <div ref={diffRef} className="mt-3 max-h-72 overflow-auto rounded-control border border-line font-mono text-xs">
          {rows.map((row, index) => (
            <div
              key={`${row.kind}-${index}`}
              data-change={row.kind === "same" ? "false" : "true"}
              className={`flex gap-2 px-2 py-0.5 ${
                row.kind === "added" ? "bg-success/10" : row.kind === "removed" ? "bg-error/10" : ""
              }`}
            >
              <span aria-hidden="true" className="w-3 shrink-0 text-ink-soft">
                {row.kind === "added" ? "+" : row.kind === "removed" ? "−" : " "}
              </span>
              <span className="whitespace-pre-wrap break-words">{row.text === "" ? "\u00a0" : row.text}</span>
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
