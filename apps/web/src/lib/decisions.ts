import type { CreateDecisionInput, DecisionDto } from "@workspace/shared";
import { ApiError } from "./api.js";

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
  const body = (await res.json()) as { data?: T; error?: { code: string; message: string; details?: unknown } };
  if (!res.ok || body.error) {
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN_ERROR", body.error?.message ?? "Terjadi kesalahan.", body.error?.details);
  }
  return body.data as T;
}

export function listDecisions(projectId: string): Promise<DecisionDto[]> {
  return request<{ items: DecisionDto[] }>(`/projects/${encodeURIComponent(projectId)}/decisions`).then((d) => d.items);
}

export function saveDecision(projectId: string, input: CreateDecisionInput): Promise<DecisionDto> {
  return request<DecisionDto>(`/projects/${encodeURIComponent(projectId)}/decisions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
