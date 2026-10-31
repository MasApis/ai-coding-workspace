import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { describeAiStatus } from "../../lib/aiStatus.js";
import { getGlobalPreference, listProviders } from "../../lib/providers.js";

// States come from real provider data. Green means inference stays on this
// machine; amber means the selected context is sent to a remote provider.
// A failed lookup never claims a connection.
export function AIConnectionIndicator() {
  const providersQuery = useQuery({ queryKey: ["providers"], queryFn: listProviders, staleTime: 30000, retry: false });
  const preferenceQuery = useQuery({ queryKey: ["ai-preferences"], queryFn: getGlobalPreference, staleTime: 30000, retry: false });

  const pending = providersQuery.isPending || preferenceQuery.isPending;
  const failed = providersQuery.isError || preferenceQuery.isError;
  const status = pending || failed ? null : describeAiStatus(providersQuery.data ?? [], preferenceQuery.data ?? null);

  const label = pending
    ? "Memeriksa AI…"
    : failed
      ? "Status AI tidak tersedia"
      : status?.kind === "ready"
        ? (status.reach === "local" ? "Lokal" : "Remote")
        : "AI belum dikonfigurasi";

  const dot = pending
    ? "bg-ink-soft"
    : failed
      ? "bg-error"
      : status?.kind === "ready"
        ? (status.reach === "local" ? "bg-success" : "bg-warning")
        : "bg-ink-soft";

  const title =
    status?.kind === "ready"
      ? `${status.providerLabel} · model ${status.modelId} · ${status.reach === "local" ? "inferensi di perangkat ini" : "konteks dikirim ke provider remote"}`
      : "Buka pengaturan AI";

  return (
    <Link
      to="/settings"
      title={title}
      aria-label={`Status AI: ${status?.kind === "ready" ? `${status.providerLabel}, ${label}` : label}. Buka pengaturan AI`}
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-soft hover:text-ink"
    >
      <span aria-hidden="true" className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} />
      {status?.kind === "ready" && <span className="hidden sm:inline">{status.providerLabel} · </span>}
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}
