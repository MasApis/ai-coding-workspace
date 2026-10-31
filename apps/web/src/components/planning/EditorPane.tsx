import type { DocumentDto, DocumentVersionDto } from "@workspace/shared";
import { Alert } from "../Alert.js";
import { Badge } from "../Badge.js";
import { Button } from "../Button.js";
import { Select } from "../TextField.js";
import { renderMarkdown } from "../../lib/markdown.js";

export function EditorPane({
  doc,
  versions,
  viewingVersionNo,
  content,
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
  if (!doc) {
    return (
      <Alert variant="empty" title="Dokumen belum ada">
        Buat kosong atau generate dengan AI dari panel samping.
      </Alert>
    );
  }

  const readOnly = viewingVersionNo !== null;
  const approved = doc.approvalState === "approved";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{doc.title}</h2>
        {doc.approvalState === "approved" && <Badge variant="success">Disetujui</Badge>}
        {doc.approvalState === "reviewed" && <Badge variant="accent">Direview</Badge>}
        {doc.approvalState === "draft" && <Badge>Draf v{doc.currentVersionNo}</Badge>}
        {doc.stale && <Badge variant="warning">Usang — dokumen hulu berubah</Badge>}
        {dirty && <span className="text-xs font-medium text-warning">Belum disimpan</span>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Mode editor" className="flex gap-1 rounded-control border border-line p-1">
          {(["edit", "preview"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => onView(v)}
              className={`rounded px-3 py-1 text-sm ${view === v ? "bg-accent-soft font-medium text-accent" : "text-ink-soft"}`}
            >
              {v === "edit" ? "Edit" : "Pratinjau"}
            </button>
          ))}
        </div>
        <Select
          label="Versi"
          value={viewingVersionNo === null ? "current" : String(viewingVersionNo)}
          onChange={(e) => onSelectVersion(e.target.value === "current" ? null : Number(e.target.value))}
        >
          <option value="current">Terkini (v{doc.currentVersionNo})</option>
          {versions.map((v) => (
            <option key={v.id} value={v.versionNo}>
              v{v.versionNo} — {v.origin}
            </option>
          ))}
        </Select>
      </div>

      {readOnly && (
        <Alert variant="info" title={`Melihat versi lama v${viewingVersionNo}`}>
          Versi lama tidak dapat diubah; menyimpan selalu membuat versi baru dari yang terkini.
        </Alert>
      )}

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
        <div
          aria-label="Pratinjau"
          className="max-w-none overflow-x-auto rounded-control border border-line bg-surface p-4 text-sm [&_code]:rounded [&_code]:bg-canvas [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-line [&_td]:px-2 [&_th]:border [&_th]:border-line [&_th]:bg-canvas [&_th]:px-2 [&_ul]:my-2"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
      )}

      {saveError && (
        <Alert variant="error" title="Penyimpanan gagal">
          {saveError}
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {!approved && (
          <Button disabled={!dirty || readOnly || saving} onClick={() => onSave(false)}>
            {saving ? "Menyimpan…" : "Simpan versi baru"}
          </Button>
        )}
        {approved && (
          <Button disabled={!dirty || readOnly || saving} onClick={() => onSave(true)}>
            {saving ? "Menyimpan…" : "Buat draf baru dari approved"}
          </Button>
        )}
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
  );
}
