import { AnthropicAdapter } from "./anthropic.js";
import { GatewayError } from "./errors.js";
import { GeminiAdapter } from "./gemini.js";
import { OllamaAdapter } from "./ollama.js";
import { OpenAIAdapter } from "./openai.js";
import { OpenAICompatibleAdapter } from "./openaiCompatible.js";
import type { ProviderAdapter, ResolvedProviderConfig } from "./types.js";

const adapters: Record<ResolvedProviderConfig["protocol"], ProviderAdapter> = {
  "openai-compatible": new OpenAICompatibleAdapter(),
  openai: new OpenAIAdapter(),
  anthropic: new AnthropicAdapter(),
  gemini: new GeminiAdapter(),
  ollama: new OllamaAdapter(),
};

export function getAdapter(protocol: ResolvedProviderConfig["protocol"]): ProviderAdapter {
  const adapter = adapters[protocol];
  if (!adapter) {
    throw new GatewayError("ADAPTER_UNAVAILABLE", `no adapter for protocol "${protocol}"`);
  }
  return adapter;
}
