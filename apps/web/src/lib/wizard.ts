export interface WizardDraft {
  name: string;
  idea: string;
  audience: string;
  constraints: string;
}

export const EMPTY_DRAFT: WizardDraft = { name: "", idea: "", audience: "", constraints: "" };

export const STEP_TITLES = ["Ide", "Audiens", "Batasan", "Ulasan"] as const;

export function canProceed(step: number, draft: WizardDraft): boolean {
  if (step === 0) return draft.name.trim().length > 0;
  return true;
}

export function buildDescription(draft: WizardDraft): string | undefined {
  const parts: string[] = [];
  const idea = draft.idea.trim();
  const audience = draft.audience.trim();
  const constraints = draft.constraints.trim();
  if (idea) parts.push(idea);
  if (audience) parts.push(`Pengguna: ${audience}`);
  if (constraints) parts.push(`Stack/Batasan: ${constraints}`);
  if (parts.length === 0) return undefined;
  return parts.join("\n\n");
}
