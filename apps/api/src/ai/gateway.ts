import { eq } from "drizzle-orm";
import type { ChatStreamRequest } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { providerConfigs } from "../db/schema.js";
import { GatewayError } from "./errors.js";
import { getAdapter } from "./registry.js";
import { readCredential } from "../services/providerService.js";
import { getPreferences } from "../services/providerService.js";
import type { ChatMessage, ResolvedProviderConfig, StreamEvent, TimeoutPolicy } from "./types.js";

export interface ChatTarget {
  providerId: string;
  model: string;
  messages: ChatMessage[];
  maxOutputTokens: number;
}

async function loadConfig(db: AppDatabase, key: Buffer, providerId: string): Promise<ResolvedProviderConfig> {
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

// Explicit body selection wins; otherwise project preference, then global
// preference. No silent default model is ever invented.
export async function resolveChatTarget(
  db: AppDatabase,
  key: Buffer,
  input: ChatStreamRequest,
): Promise<{ config: ResolvedProviderConfig; target: ChatTarget }> {
  let providerId = input.providerId;
  let model = input.modelId;
  if (!providerId && input.projectId) {
    try {
      const pref = await getPreferences(db, "project", input.projectId);
      providerId = pref.providerId;
      model ??= pref.modelId;
    } catch {
      // Fall through to the global preference.
    }
  }
  if (!providerId) {
    try {
      const pref = await getPreferences(db, "global", null);
      providerId = pref.providerId;
      model ??= pref.modelId;
    } catch {
      // No preference configured.
    }
  }
  if (!providerId || !model) {
    throw new GatewayError("NO_PROVIDER_CONFIGURED", "no provider configured; add one in Settings first");
  }
  const config = await loadConfig(db, key, providerId);
  return { config, target: { providerId, model, messages: input.messages, maxOutputTokens: input.maxOutputTokens } };
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
