import type { ExportDto } from "@workspace/shared";
import { ApiError } from "./api.js";

export async function createExport(projectId: string, includeDrafts = false): Promise<ExportDto> {
  let res: Response;
  try {
    res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeDrafts }),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Tidak dapat menghubungi server lokal.");
  }
  const body = (await res.json()) as { data?: ExportDto; error?: { code: string; message: string } };
  if (!res.ok || body.error) {
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN_ERROR", body.error?.message ?? "Ekspor gagal.");
  }
  return body.data as ExportDto;
}

export function downloadUrl(exportId: string): string {
  return `/api/exports/${encodeURIComponent(exportId)}/download`;
}
