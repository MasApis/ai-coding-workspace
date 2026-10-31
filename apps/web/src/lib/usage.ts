import type { AiPreferencesDto } from "@workspace/shared";
import { ApiError } from "./api.js";

export interface UsageSummary {
  requests: number;
  errors: number;
  tokensIn: number;
  tokensOut: number;
}

export async function getUsage(projectId?: string): Promise<UsageSummary> {
  const path = projectId ? `/api/ai/usage?projectId=${encodeURIComponent(projectId)}` : "/api/ai/usage";
  let res: Response;
  try {
    res = await fetch(path);
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Tidak dapat menghubungi server lokal.");
  }
  const body = (await res.json()) as { data?: UsageSummary; error?: { code: string; message: string } };
  if (!res.ok || body.error) {
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN_ERROR", body.error?.message ?? "Gagal memuat penggunaan.");
  }
  return body.data as UsageSummary;
}

export async function getFallback(): Promise<AiPreferencesDto | null> {
  let res: Response;
  try {
    res = await fetch("/api/ai/fallback");
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Tidak dapat menghubungi server lokal.");
  }
  if (res.status === 404) return null;
  const body = (await res.json()) as { data?: AiPreferencesDto; error?: { code: string; message: string } };
  if (!res.ok || body.error) {
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN_ERROR", body.error?.message ?? "Gagal memuat fallback.");
  }
  return body.data as AiPreferencesDto;
}

export async function setFallback(providerId: string, modelId: string): Promise<AiPreferencesDto> {
  let res: Response;
  try {
    res = await fetch("/api/ai/fallback", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId, modelId }),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Tidak dapat menghubungi server lokal.");
  }
  const body = (await res.json()) as { data?: AiPreferencesDto; error?: { code: string; message: string } };
  if (!res.ok || body.error) {
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN_ERROR", body.error?.message ?? "Penyimpanan gagal.");
  }
  return body.data as AiPreferencesDto;
}

export async function clearFallback(): Promise<void> {
  await fetch("/api/ai/fallback", { method: "DELETE" });
}
