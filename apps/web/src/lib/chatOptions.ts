import type { ProviderModelInfo } from "./providers.js";

export interface ModelOption {
  value: string;
  label: string;
}

// Empty value means "use the resolved default". Duplicate ids are collapsed so
// a provider that lists the same model twice cannot produce two identical
// options. Entries without an id carry no selectable value and are dropped.
// The app never adds a model id the provider did not report.
export function modelOptions(models: ProviderModelInfo[], defaultModelId: string): ModelOption[] {
  const seen = new Set<string>();
  const options: ModelOption[] = [{ value: "", label: `Default (${defaultModelId})` }];
  for (const model of models) {
    if (!model.id || seen.has(model.id)) continue;
    seen.add(model.id);
    options.push({
      value: model.id,
      label: model.label ? `${model.label} — ${model.id}` : model.id,
    });
  }
  return options;
}

// When the provider cannot list models, the only honest option is manual entry.
export function usesManualModelEntry(modelsAvailable: boolean, count: number): boolean {
  return !modelsAvailable || count === 0;
}
