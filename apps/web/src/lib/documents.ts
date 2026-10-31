import type { CreateDocumentInput, CreateVersionInput, DocumentDto, DocumentVersionDto } from "@workspace/shared";
import { ApiError } from "./api.js";
import { readSseEvents } from "./sse.js";

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
  const body = (await res.json()) as { data?: T; error?: { code: string; message: string } };
  if (!res.ok || body.error) {
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN_ERROR", body.error?.message ?? "Terjadi kesalahan.");
  }
  return body.data as T;
}

export function listDocuments(projectId: string): Promise<DocumentDto[]> {
  return request<{ items: DocumentDto[] }>(`/projects/${encodeURIComponent(projectId)}/documents`).then((d) => d.items);
}

export function createDocument(projectId: string, input: CreateDocumentInput): Promise<DocumentDto> {
  return request<DocumentDto>(`/projects/${encodeURIComponent(projectId)}/documents`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createVersion(documentId: string, input: CreateVersionInput): Promise<DocumentDto> {
  return request<DocumentDto>(`/documents/${encodeURIComponent(documentId)}/versions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listVersions(documentId: string): Promise<DocumentVersionDto[]> {
  return request<{ items: DocumentVersionDto[] }>(`/documents/${encodeURIComponent(documentId)}/versions`).then((d) => d.items);
}

export function reviewDocument(documentId: string): Promise<DocumentDto> {
  return request<DocumentDto>(`/documents/${encodeURIComponent(documentId)}/review`, { method: "POST" });
}

export function approveDocument(documentId: string): Promise<DocumentDto> {
  return request<DocumentDto>(`/documents/${encodeURIComponent(documentId)}/approve`, { method: "POST" });
}

export function friendlyDocumentError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "NETWORK_ERROR":
        return "Tidak dapat menghubungi server lokal.";
      case "APPROVED_LOCKED":
        return "Dokumen sudah approved. Buat draf baru secara eksplisit untuk mengubahnya.";
      case "INVALID_STATE":
        return "Aksi tidak sesuai status dokumen saat ini.";
      case "DOCUMENT_TYPE_TAKEN":
        return "Jenis dokumen ini sudah ada di proyek.";
      case "NO_PROVIDER_CONFIGURED":
        return "Belum ada provider AI. Tambahkan di Pengaturan.";
      default:
        return err.message;
    }
  }
  return "Terjadi kesalahan yang tidak dikenal.";
}

export async function generateDocumentStream(
  projectId: string,
  documentType: string,
  fromApproved: boolean,
  signal: AbortSignal,
  onEvent: (event: { type: string; [key: string]: unknown }) => void,
): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/plan/generate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentType, fromApproved }),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
    throw new ApiError(res.status, body?.error?.code ?? "UNKNOWN_ERROR", body?.error?.message ?? "Pembuatan gagal.");
  }
  for await (const event of readSseEvents(res, signal)) {
    onEvent(event);
    if (event.type === "complete" || event.type === "error" || event.type === "cancelled") return;
  }
}
