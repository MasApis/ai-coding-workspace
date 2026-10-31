import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type {
  AiPreferencesDto,
  CreateProviderInput,
  ModelPresetDto,
  ProviderDto,
  ProviderProtocol,
  UpdateProviderInput,
} from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { aiPreferences, modelPresets, providerConfigs, providerSecrets } from "../db/schema.js";
import { HttpError } from "../http/errors.js";
import { getProject } from "./projectService.js";
import { openSecret, sealSecret } from "./secrets.js";

type ConfigRow = typeof providerConfigs.$inferSelect;

function toDto(row: ConfigRow, hasCredential: boolean): ProviderDto {
  return {
    id: row.id,
    label: row.label,
    protocol: row.protocol as ProviderProtocol,
    baseUrl: row.baseUrl,
    enabled: row.enabled,
    hasCredential,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function secretIds(db: AppDatabase): Promise<Set<string>> {
  const rows = await db.select({ providerId: providerSecrets.providerId }).from(providerSecrets).all();
  return new Set(rows.map((r) => r.providerId));
}

export async function listProviders(db: AppDatabase): Promise<ProviderDto[]> {
  const rows = await db.select().from(providerConfigs).all();
  const sealed = await secretIds(db);
  return rows.map((r) => toDto(r, sealed.has(r.id)));
}

async function requireProvider(db: AppDatabase, id: string): Promise<ConfigRow> {
  const row = await db.select().from(providerConfigs).where(eq(providerConfigs.id, id)).get();
  if (!row) throw new HttpError("PROVIDER_NOT_FOUND", `provider not found: ${id}`);
  return row;
}

export async function createProvider(db: AppDatabase, key: Buffer, input: CreateProviderInput): Promise<ProviderDto> {
  const id = randomUUID();
  await db
    .insert(providerConfigs)
    .values({
      id,
      label: input.label,
      protocol: input.protocol,
      baseUrl: input.baseUrl ?? null,
      enabled: input.enabled,
    })
    .run();
  if (input.credential !== undefined) {
    const sealed = sealSecret(input.credential, key);
    await db.insert(providerSecrets).values({ providerId: id, ...sealed }).run();
  }
  return toDto((await requireProvider(db, id)) as ConfigRow, input.credential !== undefined);
}

export async function updateProvider(db: AppDatabase, key: Buffer, id: string, input: UpdateProviderInput): Promise<ProviderDto> {
  await requireProvider(db, id);
  const patch: Partial<{ label: string; baseUrl: string | null; enabled: boolean }> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.baseUrl !== undefined) patch.baseUrl = input.baseUrl;
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (Object.keys(patch).length > 0) {
    await db.update(providerConfigs).set(patch).where(eq(providerConfigs.id, id)).run();
  }
  if (input.credential !== undefined) {
    const sealed = sealSecret(input.credential, key);
    await db
      .insert(providerSecrets)
      .values({ providerId: id, ...sealed })
      .onConflictDoUpdate({ target: providerSecrets.providerId, set: { ...sealed } })
      .run();
  }
  return toDto((await requireProvider(db, id)) as ConfigRow, (await secretIds(db)).has(id));
}

// Exported for the gateway (AI-025). Never called with logging of the result.
export async function readCredential(db: AppDatabase, key: Buffer, providerId: string): Promise<string | null> {
  const row = await db.select().from(providerSecrets).where(eq(providerSecrets.providerId, providerId)).get();
  if (!row) return null;
  return openSecret({ ciphertext: row.ciphertext, iv: row.iv }, key);
}

export async function deleteProvider(db: AppDatabase, id: string): Promise<void> {
  await requireProvider(db, id);
  await db.delete(aiPreferences).where(eq(aiPreferences.providerId, id)).run();
  // Secrets and model presets cascade via FK.
  await db.delete(providerConfigs).where(eq(providerConfigs.id, id)).run();
}

export async function replaceModels(db: AppDatabase, providerId: string, models: string[]): Promise<ModelPresetDto[]> {
  await requireProvider(db, providerId);
  await db.delete(modelPresets).where(eq(modelPresets.providerId, providerId)).run();
  for (const modelId of models) {
    await db.insert(modelPresets).values({ id: randomUUID(), providerId, modelId }).run();
  }
  const rows = await db.select().from(modelPresets).where(eq(modelPresets.providerId, providerId)).all();
  return rows.map((r) => ({ id: r.id, providerId: r.providerId, modelId: r.modelId, label: r.label, enabled: r.enabled }));
}

async function requireUsableProvider(db: AppDatabase, providerId: string): Promise<void> {
  const row = await requireProvider(db, providerId);
  if (!row.enabled) throw new HttpError("PROVIDER_DISABLED", `provider is disabled: ${providerId}`);
}

export async function setPreferences(
  db: AppDatabase,
  scopeType: "global" | "project",
  scopeId: string | null,
  providerId: string,
  modelId: string,
): Promise<AiPreferencesDto> {
  await requireUsableProvider(db, providerId);
  if (scopeType === "project" && scopeId !== null) {
    await getProject(db, scopeId);
  }
  const existing = await db
    .select()
    .from(aiPreferences)
    .where(
      scopeId === null
        ? and(eq(aiPreferences.scopeType, scopeType), isNull(aiPreferences.scopeId))
        : and(eq(aiPreferences.scopeType, scopeType), eq(aiPreferences.scopeId, scopeId)),
    )
    .get();
  if (existing) {
    await db.update(aiPreferences).set({ providerId, modelId }).where(eq(aiPreferences.id, existing.id)).run();
  } else {
    await db.insert(aiPreferences).values({ id: randomUUID(), scopeType, scopeId, providerId, modelId }).run();
  }
  return { providerId, modelId };
}

export async function getPreferences(db: AppDatabase, scopeType: "global" | "project", scopeId: string | null): Promise<AiPreferencesDto> {
  const row = await db
    .select()
    .from(aiPreferences)
    .where(
      scopeId === null
        ? and(eq(aiPreferences.scopeType, scopeType), isNull(aiPreferences.scopeId))
        : and(eq(aiPreferences.scopeType, scopeType), eq(aiPreferences.scopeId, scopeId)),
    )
    .get();
  if (!row) throw new HttpError("PREFERENCE_NOT_FOUND", "no AI preference set for this scope");
  return { providerId: row.providerId, modelId: row.modelId };
}
