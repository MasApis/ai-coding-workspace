import type { AiPreferencesDto, ProviderDto, ProviderProtocol } from "@workspace/shared";
import { ApiError } from "./api.js";

export interface ProviderForm {
  label: string;
  protocol: ProviderProtocol;
  baseUrl?: string;
  credential?: string;
  removeCredential?: boolean;
  enabled: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...(init?.body ? { headers: { "Content-Type": "application/json" } } : {}),
      ...init,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Tidak dapat menghubungi server lokal.");
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json()) as { data?: T; error?: { code: string; message: string; details?: unknown } };
  if (!res.ok || body.error) {
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN_ERROR", body.error?.message ?? "Terjadi kesalahan.", body.error?.details);
  }
  return body.data as T;
}

export function listProviders(): Promise<ProviderDto[]> {
  return request<{ items: ProviderDto[] }>("/providers").then((d) => d.items);
}

export function createProvider(input: ProviderForm): Promise<ProviderDto> {
  return request<ProviderDto>("/providers", { method: "POST", body: JSON.stringify(input) });
}

export function updateProvider(id: string, input: Partial<ProviderForm>): Promise<ProviderDto> {
  return request<ProviderDto>(`/providers/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteProvider(id: string): Promise<void> {
  return request<void>(`/providers/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export interface ConnectionTest {
  ok: boolean;
  message: string;
  modelsAvailable: boolean;
}

export interface UpdateProviderPayload {
  label: string;
  baseUrl?: string;
  credential?: string;
  removeCredential?: boolean;
  enabled: boolean;
}

// Builds the exact PATCH body: protocol and other dialog-only fields must
// never be sent (the server schema is strict and rejects unknown keys).
export function buildUpdatePayload(input: {
  label: string;
  baseUrl: string;
  credential: string;
  removeCredential: boolean;
  enabled: boolean;
}): UpdateProviderPayload {
  return {
    label: input.label,
    ...(input.baseUrl ? { baseUrl: input.baseUrl } : {}),
    ...(input.credential ? { credential: input.credential } : {}),
    ...(input.removeCredential ? { removeCredential: true as const } : {}),
    enabled: input.enabled,
  };
}

// Flattens a zod treeifyError payload into readable "field: message" lines.
export function formatValidationDetails(err: unknown): string[] {
  if (!(err instanceof ApiError) || err.code !== "VALIDATION_ERROR") return [];
  const details = err.details as { errors?: unknown; properties?: Record<string, { errors?: unknown }> } | null | undefined;
  if (!details || typeof details !== "object") return [];
  const lines: string[] = [];
  if (Array.isArray(details.errors)) {
    for (const e of details.errors) {
      if (typeof e === "string" && e) lines.push(e);
    }
  }
  if (details.properties && typeof details.properties === "object") {
    for (const [field, value] of Object.entries(details.properties)) {
      const errs = (value as { errors?: unknown }).errors;
      if (Array.isArray(errs)) {
        for (const e of errs) {
          if (typeof e === "string" && e) lines.push(`${field}: ${e}`);
        }
      } else {
        lines.push(`${field}: tidak valid`);
      }
    }
  }
  return lines;
}

export interface EffectiveSelection {
  providerId: string;
  modelId: string;
  scope: "explicit" | "project" | "global";
}

export async function getEffectiveSelection(projectId?: string): Promise<EffectiveSelection | null> {
  const path = projectId ? `/ai/resolved?projectId=${encodeURIComponent(projectId)}` : "/ai/resolved";
  try {
    return await request<EffectiveSelection>(path);
  } catch (err) {
    if (err instanceof ApiError && err.code === "NO_PROVIDER_CONFIGURED") return null;
    throw err;
  }
}

export function testProvider(id: string, modelId?: string): Promise<ConnectionTest> {
  return request<ConnectionTest>(`/providers/${encodeURIComponent(id)}/test`, {
    method: "POST",
    body: JSON.stringify(modelId ? { modelId } : {}),
  });
}

// The API returns live provider listings ({ id, label? }), not stored presets:
// for OpenAI-compatible providers `id` is the model id reported by /v1/models.
export interface ProviderModelInfo {
  id: string;
  label?: string;
}

export function listModels(id: string): Promise<{ items: ProviderModelInfo[]; modelsAvailable: boolean }> {
  return request<{ items: ProviderModelInfo[]; modelsAvailable: boolean }>(`/providers/${encodeURIComponent(id)}/models`);
}

export function getGlobalPreference(): Promise<AiPreferencesDto | null> {
  return request<AiPreferencesDto>("/ai/preferences").catch((err: unknown) => {
    if (err instanceof ApiError && err.code === "PREFERENCE_NOT_FOUND") return null;
    throw err;
  });
}

export function setGlobalPreference(providerId: string, modelId: string): Promise<AiPreferencesDto> {
  return request<AiPreferencesDto>("/ai/preferences", { method: "PUT", body: JSON.stringify({ providerId, modelId }) });
}

const FRIENDLY: Record<string, string> = {
  NETWORK_ERROR: "Tidak dapat menghubungi server lokal. Pastikan API berjalan.",
  UNAUTHORIZED: "Kredensial ditolak provider. Periksa kembali API key.",
  INVALID_MODEL: "Model tidak dikenal provider. Periksa ID model.",
  QUOTA_EXCEEDED: "Kuota provider habis.",
  RATE_LIMITED: "Provider membatasi laju. Tunggu sebentar lalu coba lagi.",
  UPSTREAM_TIMEOUT: "Waktu habis menunggu provider. Coba lagi.",
  UPSTREAM_NETWORK: "Tidak dapat menjangkau provider. Periksa koneksi dan URL.",
  UPSTREAM_ERROR: "Provider mengembalikan galat.",
  MALFORMED_STREAM: "Respons provider tidak dikenali.",
  UNSAFE_REDIRECT: "Provider mengalihkan ke alamat yang tidak aman.",
  REMOTE_BLOCKED: "Alamat provider tidak diizinkan (kebijakan jaringan lokal).",
  NO_PROVIDER_CONFIGURED: "Belum ada provider dikonfigurasi. Tambahkan satu dulu.",
  ADAPTER_UNAVAILABLE: "Protokol ini belum didukung aplikasi.",
  PROVIDER_NOT_FOUND: "Provider tidak ditemukan.",
  PROVIDER_DISABLED: "Provider dalam keadaan nonaktif.",
  VALIDATION_ERROR: "Isian belum valid. Periksa kembali formulir.",
};

export function friendlyProviderError(code: string, fallback?: string): string {
  return FRIENDLY[code] ?? fallback ?? "Terjadi kesalahan yang tidak dikenal.";
}
