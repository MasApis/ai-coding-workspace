import { GatewayError } from "./errors.js";
import {
  assertRoutableTarget,
  fetchWithPolicy,
  liveSignal,
  readJsonBounded,
  type LiveSignal,
} from "./httpShared.js";
import type { Capability, ChatMessage, ConnectionTest, ModelInfo, ProviderAdapter, ResolvedProviderConfig, StreamEvent, TimeoutPolicy } from "./types.js";
import { DEFAULT_TIMEOUTS, MAX_RESPONSE_CHARS } from "./types.js";

export const OLLAMA_DEFAULT_BASE = "http://127.0.0.1:11434";
const MAX_REDIRECTS = 2;
const TEST_TIMEOUT_MS = 15000;

// Native Ollama API (NDJSON, not SSE). No credential is required; the
// default base is loopback. A missing Ollama installation surfaces as an
// honest UPSTREAM_NETWORK error and never blocks app startup, because
// nothing here runs until a request arrives.
export class OllamaAdapter implements ProviderAdapter {
  capabilities(): ReadonlySet<Capability> {
    return new Set(["streaming", "models-list", "test-connection"]);
  }

  private baseOf(config: ResolvedProviderConfig): string {
    return (config.baseUrl ?? OLLAMA_DEFAULT_BASE).replace(/\/+$/, "");
  }

  private headers(): Record<string, string> {
    return { "Content-Type": "application/json" };
  }

  async listModels(config: ResolvedProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]> {
    const base = this.baseOf(config);
    await assertRoutableTarget(`${base}/api/tags`);
    const bounded = signal ? AbortSignal.any([signal, AbortSignal.timeout(TEST_TIMEOUT_MS)]) : AbortSignal.timeout(TEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/api/tags`, { headers: this.headers(), signal: bounded });
      const parsed = await readJsonBounded(res);
      if (!res.ok || parsed === null || typeof parsed !== "object" || !("models" in parsed) || !Array.isArray((parsed as { models: unknown }).models)) {
        throw new GatewayError("UPSTREAM_ERROR", "model list is unavailable for this Ollama host");
      }
      return (parsed as { models: Array<{ name?: unknown }> }).models
        .filter((m) => typeof m.name === "string")
        .map((m) => ({ id: m.name as string }));
    } catch (err) {
      throw this.networkError(config, err);
    }
  }

  private networkError(config: ResolvedProviderConfig, err: unknown): GatewayError {
    if (err instanceof GatewayError) return err;
    return new GatewayError("UPSTREAM_NETWORK", `Ollama is not running at ${this.baseOf(config)}`);
  }

  async testConnection(config: ResolvedProviderConfig, modelId?: string, timeouts?: TimeoutPolicy): Promise<ConnectionTest> {
    const total = timeouts?.totalTimeoutMs ?? TEST_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), total);
    try {
      const base = this.baseOf(config);
      if (!modelId) {
        try {
          const models = await this.listModels(config, controller.signal);
          return { ok: true, message: models.length > 0 ? `connected, ${models.length} model(s) available` : "connected", modelsAvailable: true };
        } catch {
          return { ok: false, message: "Ollama is not running at this address", modelsAvailable: false };
        }
      }
      await assertRoutableTarget(`${base}/api/chat`);
      const res = await fetchWithPolicy(
        `${base}/api/chat`,
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({ model: modelId, messages: [{ role: "user", content: "ping" }], stream: false, options: { num_predict: 1 } }),
          signal: controller.signal,
        },
        MAX_REDIRECTS,
      );
      const parsed = await readJsonBounded(res);
      if (!res.ok) return { ok: false, message: "Ollama request failed", modelsAvailable: false };
      if (parsed !== null && typeof parsed === "object" && "error" in parsed) {
        return { ok: false, message: String((parsed as { error: unknown }).error).slice(0, 300), modelsAvailable: false };
      }
      if (parsed === null || typeof parsed !== "object" || !("message" in parsed)) {
        return { ok: false, message: "Ollama responded, but the shape is not recognized", modelsAvailable: false };
      }
      return { ok: true, message: "connected, model responded", modelsAvailable: false };
    } catch (err) {
      if (err instanceof GatewayError) return { ok: false, message: err.message, modelsAvailable: false };
      return { ok: false, message: controller.signal.aborted ? "connection attempt timed out" : `Ollama is not running at ${this.baseOf(config)}`, modelsAvailable: false };
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
    const base = this.baseOf(config);
    await assertRoutableTarget(`${base}/api/chat`);
    const live = liveSignal(input.signal, policy);
    try {
      const res = await fetchWithPolicy(
        `${base}/api/chat`,
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({ model: input.model, messages: input.messages, stream: true, options: { num_predict: input.maxOutputTokens } }),
          signal: live.signal,
        },
        MAX_REDIRECTS,
      );
      if (!res.ok) throw this.networkError(config, new Error(`status ${res.status}`));
      yield* parseNdjsonStream(res, live, input.signal);
      yield { type: "done" };
    } catch (err) {
      if (err instanceof GatewayError) throw err;
      if (input.signal.aborted) throw input.signal.reason;
      if (live.timedOut()) throw new GatewayError("UPSTREAM_TIMEOUT", "Ollama timed out");
      throw this.networkError(config, err);
    } finally {
      live.dispose();
    }
  }
}

async function* parseNdjsonStream(
  res: Response,
  live: LiveSignal,
  clientSignal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const reader = res.body?.getReader();
  if (!reader) throw new GatewayError("MALFORMED_STREAM", "Ollama returned an empty response");
  const decoder = new TextDecoder();
  let buffer = "";
  let sawLine = false;
  let received = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        if (!sawLine) throw new GatewayError("MALFORMED_STREAM", "Ollama closed the stream without events");
        return;
      }
      live.resetIdle();
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n");
      while (boundary !== -1) {
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);
        if (line) {
          sawLine = true;
          let parsed: unknown;
          try {
            parsed = JSON.parse(line);
          } catch {
            throw new GatewayError("MALFORMED_STREAM", "Ollama sent a malformed stream line");
          }
          if (parsed === null || typeof parsed !== "object") {
            throw new GatewayError("MALFORMED_STREAM", "Ollama sent a malformed stream line");
          }
          const obj = parsed as { error?: unknown; message?: { content?: unknown }; done?: unknown; prompt_eval_count?: unknown; eval_count?: unknown };
          if (typeof obj.error === "string" && obj.error) {
            if (/not found/i.test(obj.error)) throw new GatewayError("INVALID_MODEL", obj.error.slice(0, 300));
            throw new GatewayError("UPSTREAM_ERROR", obj.error.slice(0, 300));
          }
          const text = obj.message?.content;
          if (typeof text === "string" && text.length > 0) {
            received += text.length;
            if (received > MAX_RESPONSE_CHARS) throw new GatewayError("RESPONSE_TOO_LARGE", "upstream response exceeded the size limit");
            yield { type: "delta", text };
          }
          if (obj.done === true) {
            yield {
              type: "usage",
              inputTokens: typeof obj.prompt_eval_count === "number" ? obj.prompt_eval_count : undefined,
              outputTokens: typeof obj.eval_count === "number" ? obj.eval_count : undefined,
            };
            return;
          }
        }
        boundary = buffer.indexOf("\n");
      }
    }
  } catch (err) {
    if (err instanceof GatewayError) throw err;
    if (clientSignal.aborted) throw clientSignal.reason;
    if (live.signal.aborted) throw live.signal.reason;
    throw new GatewayError("UPSTREAM_NETWORK", "lost connection to Ollama");
  } finally {
    reader.releaseLock();
  }
}
