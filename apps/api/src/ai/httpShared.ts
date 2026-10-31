import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { GatewayError } from "./errors.js";
import type { TimeoutPolicy } from "./types.js";

export const MAX_REDIRECTS = 2;

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

function errorMessageOf(parsed: unknown): string | null {
  if (parsed === null || typeof parsed !== "object" || !("error" in parsed)) return null;
  const err = (parsed as { error: unknown }).error;
  if (typeof err === "string" && err.length > 0 && err.length <= 500) return err.slice(0, 300);
  if (err !== null && typeof err === "object" && "message" in err) {
    const message = String((err as { message: unknown }).message);
    if (message.length > 0 && message.length <= 500) return message.slice(0, 300);
  }
  return null;
}

// OpenAI-shaped errors: {error: {message, code}}.
export function mapUpstreamStatus(status: number, parsed: unknown): GatewayError {
  const custom = errorMessageOf(parsed);
  const fallback = `upstream request failed with status ${status}`;
  if (status === 401 || status === 403) return new GatewayError("UNAUTHORIZED", "provider rejected the credentials");
  if (status === 404) return new GatewayError("INVALID_MODEL", custom ?? fallback);
  if (status === 429) {
    const blob = JSON.stringify(parsed).toLowerCase();
    if (blob.includes("quota") || blob.includes("insufficient")) {
      return new GatewayError("QUOTA_EXCEEDED", "provider quota exceeded");
    }
    return new GatewayError("RATE_LIMITED", "provider rate limit reached, retry later");
  }
  if (status === 408 || status === 504) return new GatewayError("UPSTREAM_TIMEOUT", "provider timed out");
  return new GatewayError("UPSTREAM_ERROR", custom ?? fallback);
}

// Anthropic-shaped errors: {type: "error", error: {type, message}}.
export function mapAnthropicStatus(status: number, parsed: unknown): GatewayError {
  const custom = errorMessageOf(parsed);
  const fallback = `upstream request failed with status ${status}`;
  const type =
    parsed !== null && typeof parsed === "object" && "error" in parsed
      ? (parsed as { error: { type?: unknown } }).error?.type
      : undefined;
  if (status === 401 || type === "authentication_error") {
    return new GatewayError("UNAUTHORIZED", "provider rejected the credentials");
  }
  if (status === 404 || type === "not_found_error") return new GatewayError("INVALID_MODEL", custom ?? fallback);
  if (status === 429 || type === "rate_limit_error" || type === "overloaded_error") {
    return new GatewayError("RATE_LIMITED", "provider rate limit reached, retry later");
  }
  if (status === 400 && type === "invalid_request_error") return new GatewayError("INVALID_MODEL", custom ?? fallback);
  return new GatewayError("UPSTREAM_ERROR", custom ?? fallback);
}

// Gemini-shaped errors: {error: {code, message, status}}.
export function mapGeminiStatus(status: number, parsed: unknown): GatewayError {
  let custom: string | null = null;
  let apiStatus = "";
  if (parsed !== null && typeof parsed === "object" && "error" in parsed) {
    const err = (parsed as { error: { message?: unknown; status?: unknown } }).error;
    if (err && typeof err === "object") {
      if (typeof err.message === "string" && err.message.length > 0 && err.message.length <= 500) {
        custom = err.message.slice(0, 300);
      }
      if (typeof err.status === "string") apiStatus = err.status;
    }
  }
  const fallback = `upstream request failed with status ${status}`;
  if (status === 400 && custom && /api key/i.test(custom)) {
    return new GatewayError("UNAUTHORIZED", "provider rejected the credentials");
  }
  if (status === 404 || apiStatus === "NOT_FOUND") return new GatewayError("INVALID_MODEL", custom ?? fallback);
  if (status === 429 || apiStatus === "RESOURCE_EXHAUSTED") {
    return new GatewayError("RATE_LIMITED", "provider rate limit reached, retry later");
  }
  return new GatewayError("UPSTREAM_ERROR", custom ?? fallback);
}

export interface LiveSignal {
  signal: AbortSignal;
  resetIdle: () => void;
  dispose: () => void;
  timedOut: () => boolean;
}

// Combines the client signal with total + idle timeouts. Idle is refreshed
// by calling resetIdle() on every received chunk.
export function liveSignal(input: AbortSignal, policy: TimeoutPolicy): LiveSignal {
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

export async function fetchWithPolicy(url: string, init: RequestInit, redirectsLeft: number = MAX_REDIRECTS): Promise<Response> {
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

export async function readJsonBounded(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text.length > 20000 ? text.slice(0, 20000) : text);
  } catch {
    return null;
  }
}
