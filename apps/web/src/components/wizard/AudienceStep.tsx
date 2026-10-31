import { TextArea } from "../TextField.js";
import type { WizardDraft } from "../../lib/wizard.js";

export function AudienceStep({ draft, onChange }: { draft: WizardDraft; onChange: (patch: Partial<WizardDraft>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <TextArea
        label="Siapa penggunanya?"
        placeholder="cth. siswa SMK yang belajar pemrograman…"
        value={draft.audience}
        onChange={(e) => onChange({ audience: e.target.value })}
        hint="Opsional. Boleh dikosongkan lalu tekan Lanjut."
      />
    </div>
  );
}
