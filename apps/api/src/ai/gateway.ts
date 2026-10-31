import { eq } from "drizzle-orm";
import type { ChatStreamRequest } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { providerConfigs } from "../db/schema.js";
import { GatewayError } from "./errors.js";
import { getAdapter } from "./registry.js";
import { readCredential } from "../services/providerService.js";
import { getPreferences, type PreferenceScope } from "../services/providerService.js";
import type { ChatMessage, ResolvedProviderConfig, StreamEvent, TimeoutPolicy } from "./types.js";

export interface ChatTarget {
  providerId: string;
  model: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
}

export async function loadConfig(db: AppDatabase, key: Buffer, providerId: string): Promise<ResolvedProviderConfig> {
  const row = await db.select().from(providerConfigs).where(eq(providerConfigs.id, providerId)).get();
  if (!row) {
    throw new GatewayError("NO_PROVIDER_CONFIGURED", "provider not found; configure one in Settings");
  }
  if (!row.enabled) {
    throw new GatewayError("NO_PROVIDER_CONFIGURED", "provider is disabled; enable it in Settings");
  }
  return {
    id: row.id,
    label: row.label,
    protocol: row.protocol as ResolvedProviderConfig["protocol"],
    baseUrl: row.baseUrl,
    credential: await readCredential(db, key, row.id),
    enabled: row.enabled,
  };
}

export interface EffectiveSelection {
  providerId: string;
  modelId: string;
  scope: "explicit" | "project" | "global";
}

// Single routing decision shared by Chat, Planning, and the UI: explicit
// body values win, then project preference, then global preference.
export async function getEffectiveSelection(
  db: AppDatabase,
  input: { providerId?: string; modelId?: string; projectId?: string },
): Promise<EffectiveSelection | null> {
  if (input.providerId && input.modelId) {
    return { providerId: input.providerId, modelId: input.modelId, scope: "explicit" };
  }
  if (input.projectId) {
    try {
      const pref = await getPreferences(db, "project", input.projectId);
      return { providerId: pref.providerId, modelId: input.modelId ?? pref.modelId, scope: "project" };
    } catch {
      // Fall through to the global preference.
    }
  }
  try {
    const pref = await getPreferences(db, "global", null);
    return { providerId: pref.providerId, modelId: input.modelId ?? pref.modelId, scope: "global" };
  } catch {
    return null;
  }
}

// Opt-in fallback: when the resolved primary provider is missing or
// disabled, an explicitly configured fallback takes over. This deliberately
// covers configuration-level unavailability only — never a mid-stream
// failure, where failing over could double-bill a paid request.
export async function resolveWithFallback(
  db: AppDatabase,
  key: Buffer,
  selection: { providerId: string; modelId: string } | null,
  projectId?: string,
): Promise<{ config: ResolvedProviderConfig; model: string; usedFallback: boolean }> {
  if (selection) {
    try {
      return { config: await loadConfig(db, key, selection.providerId), model: selection.modelId, usedFallback: false };
    } catch (err) {
      if (!(err instanceof GatewayError) || err.code !== "NO_PROVIDER_CONFIGURED") throw err;
    }
  }
  const scopes: Array<{ scope: PreferenceScope; scopeId: string | null }> = projectId
    ? [
        { scope: "project-fallback", scopeId: projectId },
        { scope: "global-fallback", scopeId: null },
      ]
    : [{ scope: "global-fallback", scopeId: null }];
  for (const { scope, scopeId } of scopes) {
    try {
      const pref = await getPreferences(db, scope, scopeId);
      return { config: await loadConfig(db, key, pref.providerId), model: pref.modelId, usedFallback: true };
    } catch {
      // Try the next fallback scope; the original error is rethrown below.
    }
  }
  throw new GatewayError("NO_PROVIDER_CONFIGURED", "no provider configured; add one in Settings first");
}

// Explicit body selection wins and fails loudly (no silent reroute for a
// deliberate choice); otherwise project preference, then global preference.
// No silent default model is ever invented.
export async function resolveChatTarget(
  db: AppDatabase,
  key: Buffer,
  input: ChatStreamRequest,
): Promise<{ config: ResolvedProviderConfig; target: ChatTarget }> {
  if (input.providerId && input.modelId) {
    const config = await loadConfig(db, key, input.providerId);
    return { config, target: { providerId: config.id, model: input.modelId, messages: input.messages, maxOutputTokens: input.maxOutputTokens } };
  }
  const selection = await getEffectiveSelection(db, { modelId: input.modelId, projectId: input.projectId });
  const { config, model } = await resolveWithFallback(db, key, selection, input.projectId);
  return { config, target: { providerId: config.id, model, messages: input.messages, maxOutputTokens: input.maxOutputTokens } };
}

export async function* streamChatEvents(
  db: AppDatabase,
  key: Buffer,
  input: ChatStreamRequest,
  signal: AbortSignal,
  timeouts?: TimeoutPolicy,
): AsyncGenerator<StreamEvent> {
  const { config, target } = await resolveChatTarget(db, key, input);
  const adapter = getAdapter(config.protocol);
  yield* adapter.streamChat(
    config,
    { model: target.model, messages: target.messages, signal, maxOutputTokens: target.maxOutputTokens },
    timeouts,
  );
}
