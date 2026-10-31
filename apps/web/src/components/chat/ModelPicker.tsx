import { useQuery } from "@tanstack/react-query";
import { Badge } from "../Badge.js";
import { Select, TextInput } from "../TextField.js";
import { providerReach } from "../../lib/aiStatus.js";
import { modelOptions, usesManualModelEntry } from "../../lib/chatOptions.js";
import { listModels, listProviders } from "../../lib/providers.js";

// Model choice plus the honest reach of the selected provider. The badge says
// where inference happens; it never claims the provider is reachable.
export function ModelPicker({
  providerId,
  defaultModelId,
  value,
  onChange,
  disabled = false,
}: {
  providerId: string;
  defaultModelId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const providersQuery = useQuery({ queryKey: ["providers"], queryFn: listProviders, staleTime: 30000, retry: false });
  const modelsQuery = useQuery({
    queryKey: ["provider-models", providerId],
    queryFn: () => listModels(providerId),
    staleTime: 60000,
    retry: false,
  });

  const provider = providersQuery.data?.find((entry) => entry.id === providerId) ?? null;
  const reach = provider ? providerReach(provider) : null;
  const models = modelsQuery.data?.items ?? [];
  const manual = usesManualModelEntry(modelsQuery.data?.modelsAvailable ?? false, models.length);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        {provider && <span className="font-medium text-ink">{provider.label}</span>}
        {reach && <Badge variant={reach === "local" ? "success" : "warning"}>{reach === "local" ? "Lokal" : "Remote"}</Badge>}
        {reach === "remote" && <span>Konteks yang Anda pilih dikirim ke provider ini.</span>}
        {modelsQuery.isError && <span>Daftar model tidak tersedia — masukkan ID model secara manual.</span>}
      </div>

      {manual ? (
        <TextInput
          label="Model"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defaultModelId}
          disabled={disabled}
          hint="Ketik ID model persis seperti yang dilaporkan provider."
        />
      ) : (
        <Select label="Model" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          {modelOptions(models, defaultModelId).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
