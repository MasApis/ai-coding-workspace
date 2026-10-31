import { TextArea } from "../TextField.js";
import type { WizardDraft } from "../../lib/wizard.js";

export function ConstraintsStep({ draft, onChange }: { draft: WizardDraft; onChange: (patch: Partial<WizardDraft>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <TextArea
        label="Stack & batasan"
        placeholder="cth. React + SQLite, harus offline, satu pengguna…"
        value={draft.constraints}
        onChange={(e) => onChange({ constraints: e.target.value })}
        hint="Opsional. Boleh dikosongkan lalu tekan Lanjut."
      />
    </div>
  );
}
