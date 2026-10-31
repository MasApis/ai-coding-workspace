import type { WizardDraft } from "../../lib/wizard.js";
import { buildDescription } from "../../lib/wizard.js";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-control border border-line bg-canvas p-3">
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value || "—"}</p>
    </div>
  );
}

export function ReviewStep({ draft }: { draft: WizardDraft }) {
  const description = buildDescription(draft);
  return (
    <div className="flex flex-col gap-3">
      <Row label="Nama" value={draft.name.trim()} />
      <Row label="Deskripsi tersimpan" value={description ?? "—"} />
      <p className="text-xs text-ink-soft">Menekan “Buat proyek” akan menyimpan proyek baru dan membukanya.</p>
    </div>
  );
}
