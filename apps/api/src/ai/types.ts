import type { ProviderProtocol } from "@workspace/shared";

export type Capability = "streaming" | "models-list" | "test-connection";

export interface ResolvedProviderConfig {
  id: string;
  label: string;
  protocol: ProviderProtocol;
  baseUrl: string | null;
  credential: string | null;
  enabled: boolean;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TimeoutPolicy {
  connectTimeoutMs: number;
  idleTimeoutMs: number;
  totalTimeoutMs: number;
}

export const DEFAULT_TIMEOUTS: TimeoutPolicy = {
  connectTimeoutMs: 10000,
  idleTimeoutMs: 60000,
  totalTimeoutMs: 120000,
};

export const MAX_RESPONSE_CHARS = 1000000;

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "usage"; inputTokens?: number; outputTokens?: number }
  | { type: "done" };

export interface ModelInfo {
  id: string;
  label?: string;
}

export interface ConnectionTest {
  ok: boolean;
  message: string;
  modelsAvailable: boolean;
}

export interface ProviderAdapter {
  capabilities(): ReadonlySet<Capability>;
  listModels(config: ResolvedProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]>;
  testConnection(config: ResolvedProviderConfig, modelId?: string, timeouts?: TimeoutPolicy): Promise<ConnectionTest>;
  streamChat(
    config: ResolvedProviderConfig,
    input: { model: string; messages: ChatMessage[]; signal: AbortSignal; maxOutputTokens: number },
    timeouts?: TimeoutPolicy,
  ): AsyncGenerator<StreamEvent>;
}
