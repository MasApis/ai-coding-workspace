import type { AiPreferencesDto, ProviderDto } from "@workspace/shared";

// The header badge must state exactly where inference happens (spec §8).
// "Local" means the request never leaves this machine: an Ollama protocol,
// or any provider pointed at a loopback address.
export type AiReach = "local" | "remote";

export interface AiStatus {
  kind: "unconfigured" | "ready";
  reach: AiReach | null;
  providerLabel: string | null;
  modelId: string | null;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLoopbackUrl(raw: string | null): boolean {
  if (!raw) return false;
  try {
    return LOOPBACK_HOSTS.has(new URL(raw).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function providerReach(provider: ProviderDto): AiReach {
  if (provider.protocol === "ollama") return "local";
  return isLoopbackUrl(provider.baseUrl) ? "local" : "remote";
}

// A provider only counts as configured when it is enabled *and* a default
// model resolves to it; otherwise Planning and Chat cannot run.
export function describeAiStatus(providers: ProviderDto[], preference: AiPreferencesDto | null): AiStatus {
  const provider = preference ? providers.find((p) => p.id === preference.providerId && p.enabled) : undefined;
  if (!provider || !preference) {
    return { kind: "unconfigured", reach: null, providerLabel: null, modelId: null };
  }
  return {
    kind: "ready",
    reach: providerReach(provider),
    providerLabel: provider.label,
    modelId: preference.modelId,
  };
}
