import { GatewayError } from "./errors.js";
import { OpenAICompatibleAdapter } from "./openaiCompatible.js";
import type { Capability, ChatMessage, ConnectionTest, ModelInfo, ProviderAdapter, ResolvedProviderConfig, StreamEvent, TimeoutPolicy } from "./types.js";

export const OPENAI_DEFAULT_BASE = "https://api.openai.com/v1";

// Native OpenAI shares the chat-completions SSE shape with the compatible
// adapter; this wrapper pins the default base URL and requires a credential.
export class OpenAIAdapter implements ProviderAdapter {
  private readonly inner = new OpenAICompatibleAdapter();

  capabilities(): ReadonlySet<Capability> {
    return this.inner.capabilities();
  }

  private withBase(config: ResolvedProviderConfig): ResolvedProviderConfig {
    if (!config.credential) {
      throw new GatewayError("UNAUTHORIZED", "no credential configured for this provider");
    }
    return { ...config, baseUrl: config.baseUrl ?? OPENAI_DEFAULT_BASE };
  }

  async listModels(config: ResolvedProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]> {
    return this.inner.listModels(this.withBase(config), signal);
  }

  testConnection(config: ResolvedProviderConfig, modelId?: string, timeouts?: TimeoutPolicy): Promise<ConnectionTest> {
    if (!config.credential) {
      return Promise.resolve({ ok: false, message: "no credential configured for this provider", modelsAvailable: false });
    }
    return this.inner.testConnection(this.withBase(config), modelId, timeouts);
  }

  async *streamChat(
    config: ResolvedProviderConfig,
    input: { model: string; messages: ChatMessage[]; signal: AbortSignal; maxOutputTokens: number },
    timeouts?: TimeoutPolicy,
  ): AsyncGenerator<StreamEvent> {
    yield* this.inner.streamChat(this.withBase(config), input, timeouts);
  }
}
