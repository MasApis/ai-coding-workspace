import { GatewayError } from "./errors.js";
import {
  assertRoutableTarget,
  fetchWithPolicy,
  liveSignal,
  mapGeminiStatus,
  readJsonBounded,
  type LiveSignal,
} from "./httpShared.js";
import type { Capability, ChatMessage, ConnectionTest, ModelInfo, ProviderAdapter, ResolvedProviderConfig, StreamEvent, TimeoutPolicy } from "./types.js";
import { DEFAULT_TIMEOUTS, MAX_RESPONSE_CHARS } from "./types.js";

export const GEMINI_DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta";
const MAX_REDIRECTS = 2;
const TEST_TIMEOUT_MS = 15000;

// Native Gemini API. Assistant turns become `model` roles; credentials
// travel in the x-goog-api-key header (never logged: this module logs
// nothing at all).
export class GeminiAdapter implements ProviderAdapter {
  capabilities(): ReadonlySet<Capability> {
    return new Set(["streaming", "models-list", "test-connection"]);
  }

  private baseOf(config: ResolvedProviderConfig): string {
    return (config.baseUrl ?? GEMINI_DEFAULT_BASE).replace(/\/+$/, "");
  }

  private requireCredential(config: ResolvedProviderConfig): string {
    if (!config.credential) {
      throw new GatewayError("UNAUTHORIZED", "no credential configured for this provider");
    }
    return config.credential;
  }

  private headers(config: ResolvedProviderConfig): Record<string, string> {
    return { "Content-Type": "application/json", "x-goog-api-key": this.requireCredential(config) };
  }

  private splitMessages(messages: ChatMessage[]): { systemInstruction?: { parts: Array<{ text: string }> }; contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> } {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? ("model" as const) : ("user" as const), parts: [{ text: m.content }] }));
    return system ? { systemInstruction: { parts: [{ text: system }] }, contents } : { contents };
  }

  async listModels(config: ResolvedProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]> {
    this.requireCredential(config);
    const base = this.baseOf(config);
    await assertRoutableTarget(`${base}/models`);
    const bounded = signal ? AbortSignal.any([signal, AbortSignal.timeout(TEST_TIMEOUT_MS)]) : AbortSignal.timeout(TEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/models`, { headers: this.headers(config), signal: bounded });
      const parsed = await readJsonBounded(res);
      if (!res.ok) throw mapGeminiStatus(res.status, parsed);
      if (parsed === null || typeof parsed !== "object" || !("models" in parsed) || !Array.isArray((parsed as { models: unknown }).models)) {
        throw new GatewayError("UPSTREAM_ERROR", "model list is unavailable for this provider");
      }
      return (parsed as { models: Array<{ name?: unknown }> }).models
        .filter((m) => typeof m.name === "string")
        .map((m) => ({ id: (m.name as string).split("/").pop() ?? (m.name as string) }));
    } catch (err) {
      if (err instanceof GatewayError) throw err;
      throw new GatewayError("UPSTREAM_NETWORK", "could not reach the provider");
    }
  }

  async testConnection(config: ResolvedProviderConfig, modelId?: string, timeouts?: TimeoutPolicy): Promise<ConnectionTest> {
    if (!config.credential) {
      return { ok: false, message: "no credential configured for this provider", modelsAvailable: false };
    }
    const total = timeouts?.totalTimeoutMs ?? TEST_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), total);
    try {
      const base = this.baseOf(config);
      if (!modelId) {
        try {
          const models = await this.listModels(config, controller.signal);
          return { ok: true, message: models.length > 0 ? `connected, ${models.length} model(s) listed` : "connected", modelsAvailable: true };
        } catch {
          return { ok: false, message: "connected, but the model list is unavailable; enter a model ID manually", modelsAvailable: false };
        }
      }
      await assertRoutableTarget(`${base}/models`);
      const res = await fetchWithPolicy(
        `${base}/models/${encodeURIComponent(modelId)}:generateContent`,
        {
          method: "POST",
          headers: this.headers(config),
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "ping" }] }], generationConfig: { maxOutputTokens: 1 } }),
          signal: controller.signal,
        },
        MAX_REDIRECTS,
      );
      const parsed = await readJsonBounded(res);
      if (!res.ok) throw mapGeminiStatus(res.status, parsed);
      if (parsed === null || typeof parsed !== "object" || !("candidates" in parsed)) {
        return { ok: false, message: "provider responded, but the completion shape is not recognized", modelsAvailable: false };
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
    const url = `${base}/models/${encodeURIComponent(input.model)}:streamGenerateContent?alt=sse`;
    await assertRoutableTarget(url);
    const live = liveSignal(input.signal, policy);
    try {
      const { systemInstruction, contents } = this.splitMessages(input.messages);
      const res = await fetchWithPolicy(
        url,
        {
          method: "POST",
          headers: this.headers(config),
          body: JSON.stringify({
            ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
            contents,
            generationConfig: { maxOutputTokens: input.maxOutputTokens },
          }),
          signal: live.signal,
        },
        MAX_REDIRECTS,
      );
      if (!res.ok) throw mapGeminiStatus(res.status, await readJsonBounded(res));
      if (!(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
        throw new GatewayError("MALFORMED_STREAM", "upstream did not return a stream");
      }
      yield* parseGeminiStream(res, live, input.signal);
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

async function* parseGeminiStream(res: Response, live: LiveSignal, clientSignal: AbortSignal): AsyncGenerator<StreamEvent> {
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
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of event.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          sawData = true;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return;
          let parsed: unknown;
          try {
            parsed = JSON.parse(payload);
          } catch {
            throw new GatewayError("MALFORMED_STREAM", "upstream sent a malformed stream event");
          }
          if (parsed === null || typeof parsed !== "object" || !("candidates" in parsed) || !Array.isArray((parsed as { candidates: unknown }).candidates)) {
            throw new GatewayError("MALFORMED_STREAM", "upstream sent a malformed stream event");
          }
          for (const candidate of (parsed as { candidates: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }).candidates) {
            for (const part of candidate.content?.parts ?? []) {
              if (typeof part.text === "string" && part.text.length > 0) {
                received += part.text.length;
                if (received > MAX_RESPONSE_CHARS) throw new GatewayError("RESPONSE_TOO_LARGE", "upstream response exceeded the size limit");
                yield { type: "delta", text: part.text };
              }
            }
          }
          if ("usageMetadata" in parsed && parsed.usageMetadata !== null && typeof parsed.usageMetadata === "object") {
            const usage = parsed.usageMetadata as { promptTokenCount?: unknown; candidatesTokenCount?: unknown };
            yield {
              type: "usage",
              inputTokens: typeof usage.promptTokenCount === "number" ? usage.promptTokenCount : undefined,
              outputTokens: typeof usage.candidatesTokenCount === "number" ? usage.candidatesTokenCount : undefined,
            };
          }
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
