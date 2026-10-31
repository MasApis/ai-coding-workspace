import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { GatewayError } from "./errors.js";
import type {
  ConnectionTest,
  ModelInfo,
  ProviderAdapter,
  ResolvedProviderConfig,
  StreamEvent,
  TimeoutPolicy,
} from "./types.js";
import { DEFAULT_TIMEOUTS, MAX_RESPONSE_CHARS } from "./types.js";

const MAX_REDIRECTS = 2;
const TEST_TIMEOUT_MS = 15000;

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost") return true;
  if (isIP(host) === 0) return false;
  return host === "::1" || host.startsWith("127.");
}

function isNonRoutableIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 0) return false;
  if (family === 6) {
    const lower = ip.toLowerCase();
    return (
      lower === "::1" ||
      lower === "::" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80") ||
      lower.startsWith("::ffff:")
    );
  }
  const [a, b] = ip.split(".").map(Number);
  if (a === 10) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  return a === 0;
}

// Runtime guard complementing config-time validation (AI-024): loopback
// hosts pass (explicit exception); every other host must resolve to at
// least one routable address. Residual DNS-rebinding TOCTOU is a known
// limitation, owned by AI-029 hardening.
export async function assertRoutableTarget(rawUrl: string): Promise<void> {
  const url = new URL(rawUrl);
  if (isLoopbackHost(url.hostname)) return;
  if (isIP(url.hostname) !== 0) {
    if (isNonRoutableIp(url.hostname)) {
      throw new GatewayError("REMOTE_BLOCKED", "remote host address is not allowed");
    }
    return;
  }
  let addresses;
  try {
    addresses = await lookup(url.hostname, { all: true });
  } catch {
    throw new GatewayError("UPSTREAM_NETWORK", "could not resolve remote host");
  }
  if (!addresses.some((a) => !isNonRoutableIp(a.address))) {
    throw new GatewayError("REMOTE_BLOCKED", "remote host resolves only to non-routable addresses");
  }
}

function sanitizeUpstreamMessage(status: number, parsed: unknown): string {
  if (parsed !== null && typeof parsed === "object" && "error" in parsed) {
    const err = (parsed as { error: unknown }).error;
    const message =
      typeof err === "string"
        ? err
        : err !== null && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : null;
    if (message && message.length > 0 && message.length <= 500) return message.slice(0, 300);
  }
  return `upstream request failed with status ${status}`;
}

export function mapUpstreamStatus(status: number, parsed: unknown): GatewayError {
  const message = sanitizeUpstreamMessage(status, parsed);
  if (status === 401 || status === 403) return new GatewayError("UNAUTHORIZED", "provider rejected the credentials");
  if (status === 404) return new GatewayError("INVALID_MODEL", message);
  if (status === 429) {
    const blob = JSON.stringify(parsed).toLowerCase();
    if (blob.includes("quota") || blob.includes("insufficient")) {
      return new GatewayError("QUOTA_EXCEEDED", "provider quota exceeded");
    }
    return new GatewayError("RATE_LIMITED", "provider rate limit reached, retry later");
  }
  if (status === 408 || status === 504) return new GatewayError("UPSTREAM_TIMEOUT", "provider timed out");
  return new GatewayError("UPSTREAM_ERROR", message);
}

// Combines the client signal with total + idle timeouts. Idle is refreshed
// by calling resetIdle() on every received chunk.
function liveSignal(
  input: AbortSignal,
  policy: TimeoutPolicy,
): { signal: AbortSignal; resetIdle: () => void; dispose: () => void; timedOut: () => boolean } {
  const controller = new AbortController();
  let expired = false;
  let totalTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const fireTimeout = () => {
    expired = true;
    dispose();
    controller.abort(new GatewayError("UPSTREAM_TIMEOUT", "provider timed out"));
  };
  const dispose = () => {
    if (totalTimer) clearTimeout(totalTimer);
    if (idleTimer) clearTimeout(idleTimer);
    input.removeEventListener("abort", onAbort);
  };
  const onAbort = () => {
    dispose();
    controller.abort(input.reason);
  };
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(fireTimeout, policy.idleTimeoutMs);
  };
  totalTimer = setTimeout(fireTimeout, policy.totalTimeoutMs);
  resetIdle();
  if (input.aborted) {
    dispose();
    controller.abort(input.reason);
  } else {
    input.addEventListener("abort", onAbort, { once: true });
  }
  return { signal: controller.signal, resetIdle, dispose, timedOut: () => expired };
}

async function fetchWithPolicy(url: string, init: RequestInit, redirectsLeft: number): Promise<Response> {
  const res = await fetch(url, { ...init, redirect: "manual" });
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    await res.body?.cancel();
    if (!location || redirectsLeft <= 0) {
      throw new GatewayError("UNSAFE_REDIRECT", "upstream redirect was rejected");
    }
    const next = new URL(location, url);
    const current = new URL(url);
    if (next.protocol !== "https:" || next.host !== current.host) {
      throw new GatewayError("UNSAFE_REDIRECT", "upstream redirect target is not allowed");
    }
    await assertRoutableTarget(next.toString());
    return fetchWithPolicy(next.toString(), init, redirectsLeft - 1);
  }
  return res;
}

function extractEvents(payload: string, received: { count: number }): StreamEvent[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new GatewayError("MALFORMED_STREAM", "upstream sent a malformed stream event");
  }
  if (parsed === null || typeof parsed !== "object" || !("choices" in parsed) || !Array.isArray((parsed as { choices: unknown }).choices)) {
    throw new GatewayError("MALFORMED_STREAM", "upstream sent a malformed stream event");
  }
  const events: StreamEvent[] = [];
  for (const choice of (parsed as { choices: Array<{ delta?: { content?: unknown }; message?: { content?: unknown } }> }).choices) {
    const text = choice.delta?.content ?? choice.message?.content;
    if (typeof text === "string" && text.length > 0) {
      received.count += text.length;
      if (received.count > MAX_RESPONSE_CHARS) {
        throw new GatewayError("RESPONSE_TOO_LARGE", "upstream response exceeded the size limit");
      }
      events.push({ type: "delta", text });
    }
  }
  if ("usage" in parsed && parsed.usage !== null && typeof parsed.usage === "object") {
    const usage = parsed.usage as { prompt_tokens?: unknown; completion_tokens?: unknown };
    events.push({
      type: "usage",
      inputTokens: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined,
      outputTokens: typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined,
    });
  }
  return events;
}

async function* parseSseStream(
  res: Response,
  live: { signal: AbortSignal; resetIdle: () => void },
  clientSignal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const reader = res.body?.getReader();
  if (!reader) throw new GatewayError("MALFORMED_STREAM", "upstream returned an empty stream");
  const decoder = new TextDecoder();
  const received = { count: 0 };
  let buffer = "";
  let sawDataLine = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        if (!sawDataLine) throw new GatewayError("MALFORMED_STREAM", "upstream closed the stream without events");
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
          sawDataLine = true;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") return;
          yield* extractEvents(payload, received);
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

async function readJsonBounded(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text.length > 20000 ? text.slice(0, 20000) : text);
  } catch {
    return null;
  }
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  capabilities(): ReadonlySet<"streaming" | "models-list" | "test-connection"> {
    return new Set(["streaming", "models-list", "test-connection"]);
  }

  private baseOf(config: ResolvedProviderConfig): string {
    if (!config.baseUrl) {
      throw new GatewayError("PROVIDER_MISCONFIGURED", "provider has no base URL configured");
    }
    return config.baseUrl.replace(/\/+$/, "");
  }

  private headers(config: ResolvedProviderConfig): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.credential) headers["Authorization"] = `Bearer ${config.credential}`;
    return headers;
  }

  async listModels(config: ResolvedProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]> {
    const base = this.baseOf(config);
    await assertRoutableTarget(`${base}/models`);
    const bounded = signal ? AbortSignal.any([signal, AbortSignal.timeout(TEST_TIMEOUT_MS)]) : AbortSignal.timeout(TEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/models`, { headers: this.headers(config), signal: bounded });
      const parsed = await readJsonBounded(res);
      if (!res.ok || parsed === null || typeof parsed !== "object" || !("data" in parsed) || !Array.isArray((parsed as { data: unknown }).data)) {
        throw new GatewayError("UPSTREAM_ERROR", "model list is unavailable for this provider");
      }
      return (parsed as { data: Array<{ id?: unknown }> }).data.filter((m) => typeof m.id === "string").map((m) => ({ id: m.id as string }));
    } catch (err) {
      if (err instanceof GatewayError) throw err;
      throw new GatewayError("UPSTREAM_NETWORK", "could not reach the provider");
    }
  }

  async testConnection(config: ResolvedProviderConfig, modelId?: string, timeouts?: TimeoutPolicy): Promise<ConnectionTest> {
    const total = timeouts?.totalTimeoutMs ?? TEST_TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new GatewayError("UPSTREAM_TIMEOUT", "connection attempt timed out")), total);
    try {
      if (!modelId) {
        try {
          const models = await this.listModels(config, controller.signal);
          return { ok: true, message: models.length > 0 ? `connected, ${models.length} model(s) listed` : "connected", modelsAvailable: true };
        } catch {
          return { ok: false, message: "connected, but the model list is unavailable; enter a model ID manually", modelsAvailable: false };
        }
      }
      const base = this.baseOf(config);
      await assertRoutableTarget(`${base}/chat/completions`);
      const res = await fetchWithPolicy(
        `${base}/chat/completions`,
        {
          method: "POST",
          headers: this.headers(config),
          body: JSON.stringify({ model: modelId, messages: [{ role: "user", content: "ping" }], max_tokens: 1, stream: false }),
          signal: controller.signal,
        },
        MAX_REDIRECTS,
      );
      const parsed = await readJsonBounded(res);
      if (!res.ok) throw mapUpstreamStatus(res.status, parsed);
      if (parsed === null || typeof parsed !== "object" || !("choices" in parsed)) {
        return { ok: false, message: "provider responded, but the completion shape is not recognized", modelsAvailable: false };
      }
      return { ok: true, message: "connected, model responded", modelsAvailable: false };
    } catch (err) {
      if (err instanceof GatewayError) return { ok: false, message: err.message, modelsAvailable: false };
      if (controller.signal.aborted) return { ok: false, message: "connection attempt timed out", modelsAvailable: false };
      return { ok: false, message: "could not reach the provider", modelsAvailable: false };
    } finally {
      clearTimeout(timer);
    }
  }

  async *streamChat(
    config: ResolvedProviderConfig,
    input: { model: string; messages: Array<{ role: "system" | "user" | "assistant"; content: string }>; signal: AbortSignal; maxOutputTokens: number },
    timeouts?: TimeoutPolicy,
  ): AsyncGenerator<StreamEvent> {
    const policy = timeouts ?? DEFAULT_TIMEOUTS;
    const base = this.baseOf(config);
    await assertRoutableTarget(`${base}/chat/completions`);
    const live = liveSignal(input.signal, policy);
    try {
      const res = await fetchWithPolicy(
        `${base}/chat/completions`,
        {
          method: "POST",
          headers: this.headers(config),
          body: JSON.stringify({ model: input.model, messages: input.messages, max_tokens: input.maxOutputTokens, stream: true }),
          signal: live.signal,
        },
        MAX_REDIRECTS,
      );
      if (!res.ok) throw mapUpstreamStatus(res.status, await readJsonBounded(res));
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        throw new GatewayError("MALFORMED_STREAM", "upstream did not return a stream");
      }
      yield* parseSseStream(res, live, input.signal);
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
