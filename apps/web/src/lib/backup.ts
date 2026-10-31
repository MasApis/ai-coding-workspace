import type { BackupFile, ImportResult } from "@workspace/shared";
import { ApiError } from "./api.js";

export async function exportBackup(projectId: string): Promise<BackupFile> {
  let res: Response;
  try {
    res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/backup`);
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Tidak dapat menghubungi server lokal.");
  }
  const body = (await res.json()) as BackupFile | { error?: { code: string; message: string } };
  if (!res.ok || "error" in body) {
    const err = body as { error?: { code: string; message: string } };
    throw new ApiError(res.status, err.error?.code ?? "UNKNOWN_ERROR", err.error?.message ?? "Ekspor gagal.");
  }
  return body as BackupFile;
}

export function backupDownloadUrl(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/backup`;
}

export async function importBackup(backup: BackupFile): Promise<ImportResult> {
  let res: Response;
  try {
    res = await fetch("/api/projects/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ backup }),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Tidak dapat menghubungi server lokal.");
  }
  const body = (await res.json()) as { data?: ImportResult; error?: { code: string; message: string } };
  if (!res.ok || body.error) {
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN_ERROR", body.error?.message ?? "Impor gagal.");
  }
  return body.data as ImportResult;
}

export function friendlyBackupError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "INVALID_BACKUP") return "Berkas backup tidak valid atau versinya tidak didukung.";
    if (err.code === "NETWORK_ERROR") return "Tidak dapat menghubungi server lokal.";
    return err.message;
  }
  return err instanceof Error ? err.message : "Terjadi kesalahan yang tidak dikenal.";
}
