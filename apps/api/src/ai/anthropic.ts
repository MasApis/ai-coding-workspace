import { GatewayError } from "./errors.js";
import {
  assertRoutableTarget,
  fetchWithPolicy,
  liveSignal,
  mapAnthropicStatus,
  readJsonBounded,
  type LiveSignal,
} from "./httpShared.js";
import type { Capability, ChatMessage, ConnectionTest, ModelInfo, ProviderAdapter, ResolvedProviderConfig, StreamEvent, TimeoutPolicy } from "./types.js";
import { DEFAULT_TIMEOUTS, MAX_RESPONSE_CHARS } from "./types.js";

export const ANTHROPIC_DEFAULT_BASE = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_REDIRECTS = 2;
const TEST_TIMEOUT_MS = 15000;

// Native Anthropic Messages API. System prompts travel as a top-level
// `system` field; the API has no model-listing endpoint.
export class AnthropicAdapter implements ProviderAdapter {
  capabilities(): ReadonlySet<Capability> {
    return new Set(["streaming", "test-connection"]);
  }

  private baseOf(config: ResolvedProviderConfig): string {
    return (config.baseUrl ?? ANTHROPIC_DEFAULT_BASE).replace(/\/+$/, "");
  }

  private requireCredential(config: ResolvedProviderConfig): string {
    if (!config.credential) {
      throw new GatewayError("UNAUTHORIZED", "no credential configured for this provider");
    }
    return config.credential;
  }

  private headers(config: ResolvedProviderConfig): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.requireCredential(config),
      "anthropic-version": ANTHROPIC_VERSION,
    };
  }

  private splitMessages(messages: ChatMessage[]): { system?: string; input: Array<{ role: "user" | "assistant"; content: string }> } {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const input = messages
      .filter((m): m is { role: "user" | "assistant"; content: string } => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    return system ? { system, input } : { input };
  }

  async listModels(): Promise<ModelInfo[]> {
    throw new GatewayError("UPSTREAM_ERROR", "model listing is not supported for Anthropic; enter a model ID manually");
  }

  async testConnection(config: ResolvedProviderConfig, modelId?: string, timeouts?: TimeoutPolicy): Promise<ConnectionTest> {
    if (!config.credential) {
      return { ok: false, message: "no credential configured for this provider", modelsAvailable: false };
    }
    if (!modelId) {
      return { ok: false, message: "Anthropic has no model list; enter a model ID to test", modelsAvailable: false };
    }
    const total = timeouts?.totalTimeoutMs ?? TEST_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), total);
    try {
      const base = this.baseOf(config);
      await assertRoutableTarget(`${base}/v1/messages`);
      const { system, input } = this.splitMessages([{ role: "user", content: "ping" }]);
      const res = await fetchWithPolicy(
        `${base}/v1/messages`,
        {
          method: "POST",
          headers: this.headers(config),
          body: JSON.stringify({ model: modelId, max_tokens: 1, ...(system ? { system } : {}), messages: input, stream: false }),
          signal: controller.signal,
        },
        MAX_REDIRECTS,
      );
      const parsed = await readJsonBounded(res);
      if (!res.ok) throw mapAnthropicStatus(res.status, parsed);
      if (parsed === null || typeof parsed !== "object" || !("content" in parsed)) {
        return { ok: false, message: "provider responded, but the message shape is not recognized", modelsAvailable: false };
      }
      return { ok: true, message: "connected, model responded", modelsAvailable: false };
    } catch (err) {
      if (err instanceof GatewayError) return { ok: false, message: err.message, modelsAvailable: false };
      return { ok: false, message: controller.signal.aborted ? "connection attempt timed out" : "could not reach the provider", modelsAvailable: false };
    } finally {
      clearTimeout(timer);
    }
  }

  async *streamChat(
    config: ResolvedProviderConfig,
    input: { model: string; messages: ChatMessage[]; signal: AbortSignal; maxOutputTokens: number },
    timeouts?: TimeoutPolicy,
  ): AsyncGenerator<StreamEvent> {
    const policy = timeouts ?? DEFAULT_TIMEOUTS;
    this.requireCredential(config);
    const base = this.baseOf(config);
    await assertRoutableTarget(`${base}/v1/messages`);
    const live = liveSignal(input.signal, policy);
    try {
      const { system, input: messages } = this.splitMessages(input.messages);
      const res = await fetchWithPolicy(
        `${base}/v1/messages`,
        {
          method: "POST",
          headers: this.headers(config),
          body: JSON.stringify({ model: input.model, max_tokens: input.maxOutputTokens, ...(system ? { system } : {}), messages, stream: true }),
          signal: live.signal,
        },
        MAX_REDIRECTS,
      );
      if (!res.ok) throw mapAnthropicStatus(res.status, await readJsonBounded(res));
      if (!(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
        throw new GatewayError("MALFORMED_STREAM", "upstream did not return a stream");
      }
      yield* parseAnthropicStream(res, live, input.signal);
      yield { type: "done" };
    } catch (err) {
      if (err instanceof GatewayError) throw err;
      if (input.signal.aborted) throw input.signal.reason;
      if (live.timedOut()) throw new GatewayError("UPSTREAM_TIMEOUT", "provider timed out");
      throw new GatewayError("UPSTREAM_NETWORK", "could not reach the provider");
    } finally {
      live.dispose();
    }
  }
}

async function* parseAnthropicStream(
  res: Response,
  live: LiveSignal,
  clientSignal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const reader = res.body?.getReader();
  if (!reader) throw new GatewayError("MALFORMED_STREAM", "upstream returned an empty stream");
  const decoder = new TextDecoder();
  let buffer = "";
  let sawData = false;
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        if (!sawData) throw new GatewayError("MALFORMED_STREAM", "upstream closed the stream without events");
        return;
      }
      live.resetIdle();
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let eventName = "";
        let payload = "";
        for (const line of block.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("event:")) eventName = trimmed.slice(6).trim();
          else if (trimmed.startsWith("data:")) payload = trimmed.slice(5).trim();
        }
        if (!payload) continue;
        sawData = true;
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload);
        } catch {
          throw new GatewayError("MALFORMED_STREAM", "upstream sent a malformed stream event");
        }
        if (eventName === "message_start") {
          const tokens = (parsed as { message?: { usage?: { input_tokens?: unknown } } }).message?.usage?.input_tokens;
          yield { type: "usage", inputTokens: typeof tokens === "number" ? tokens : undefined, outputTokens: undefined };
        } else if (eventName === "content_block_delta") {
          const text = (parsed as { delta?: { text?: unknown } }).delta?.text;
          if (typeof text === "string" && text.length > 0) {
            received += text.length;
            if (received > MAX_RESPONSE_CHARS) throw new GatewayError("RESPONSE_TOO_LARGE", "upstream response exceeded the size limit");
            yield { type: "delta", text };
          }
        } else if (eventName === "message_delta") {
          const tokens = (parsed as { usage?: { output_tokens?: unknown } }).usage?.output_tokens;
          yield { type: "usage", inputTokens: undefined, outputTokens: typeof tokens === "number" ? tokens : undefined };
        } else if (eventName === "error") {
          throw mapAnthropicStatus(400, parsed);
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } catch (err) {
    if (err instanceof GatewayError) throw err;
    if (clientSignal.aborted) throw clientSignal.reason;
    if (live.signal.aborted) throw live.signal.reason;
    throw new GatewayError("UPSTREAM_NETWORK", "lost connection to the provider");
  } finally {
    reader.releaseLock();
  }
}
