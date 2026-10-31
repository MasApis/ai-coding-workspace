import { TextArea, TextInput } from "../TextField.js";
import type { WizardDraft } from "../../lib/wizard.js";

export function IdeaStep({ draft, onChange }: { draft: WizardDraft; onChange: (patch: Partial<WizardDraft>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <TextInput
        label="Nama proyek"
        placeholder="cth. todo-list"
        value={draft.name}
        onChange={(e) => onChange({ name: e.target.value })}
        hint="Wajib diisi. Nama singkat yang mudah dikenali."
      />
      <TextArea
        label="Apa yang ingin dibangun?"
        placeholder="Ceritakan ide aplikasi dalam kalimat bebas…"
        value={draft.idea}
        onChange={(e) => onChange({ idea: e.target.value })}
        hint="Opsional. Semakin jelas, semakin baik hasil perencanaan."
      />
    </div>
  );
}
