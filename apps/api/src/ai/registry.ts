import { GatewayError } from "./errors.js";
import { OpenAICompatibleAdapter } from "./openaiCompatible.js";
import type { ProviderAdapter, ResolvedProviderConfig } from "./types.js";

const openaiCompatible = new OpenAICompatibleAdapter();

export function getAdapter(protocol: ResolvedProviderConfig["protocol"]): ProviderAdapter {
  if (protocol === "openai-compatible") return openaiCompatible;
  throw new GatewayError(
    "ADAPTER_UNAVAILABLE",
    `no adapter for protocol "${protocol}" yet; native adapters arrive in AI-027`,
  );
}
