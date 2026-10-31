import { readSseEvents } from "./sse.js";
import { ApiError } from "./api.js";

export function parseDesignSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = markdown.split("\n");
  let heading: string | null = null;
  let body: string[] = [];
  const flush = () => {
    if (heading) sections.set(heading, body.join("\n").trim());
    heading = null;
    body = [];
  };
  for (const line of lines) {
    const match = line.match(/^##\s+(.+)\s*$/);
    if (match) {
      flush();
      heading = match[1]?.trim() ?? "";
    } else if (heading !== null) {
      body.push(line);
    }
  }
  flush();
  return sections;
}

export interface DesignStreamHandlers {
  onProgress: (event: { section: string; done: number; total: number }) => void;
  onError: (code: string, message: string) => void;
  onDone: (result: { documentId?: string; versionNo?: number }) => void;
}

export async function generateDesignStream(
  projectId: string,
  fromApproved: boolean,
  signal: AbortSignal,
  handlers: DesignStreamHandlers,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/design/generate/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromApproved }),
      signal,
    });
  } catch (err) {
    if (signal.aborted) return;
    throw err instanceof Error ? err : new Error("network error");
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
    handlers.onError(body?.error?.code ?? "UNKNOWN_ERROR", body?.error?.message ?? "Pembuatan gagal.");
    return;
  }
  for await (const event of readSseEvents(res, signal)) {
    if (event.type === "progress" && typeof event.section === "string") {
      handlers.onProgress({ section: event.section, done: Number(event.done ?? 0), total: Number(event.total ?? 0) });
    } else if (event.type === "error") {
      handlers.onError(String(event.code ?? "UNKNOWN_ERROR"), String(event.message ?? "Terjadi kesalahan."));
      return;
    } else if (event.type === "complete") {
      handlers.onDone({
        documentId: typeof event.documentId === "string" ? event.documentId : undefined,
        versionNo: typeof event.versionNo === "number" ? event.versionNo : undefined,
      });
      return;
    } else if (event.type === "cancelled") {
      return;
    }
  }
}

export interface PrototypeVersion {
  versionNo: number;
  specVersionNo: number | null;
  createdAt: string;
}

export async function generatePrototype(projectId: string): Promise<PrototypeVersion> {
  let res: Response;
  try {
    res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/design/prototype`, { method: "POST" });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Tidak dapat menghubungi server lokal.");
  }
  const body = (await res.json()) as { data?: PrototypeVersion; error?: { code: string; message: string } };
  if (!res.ok || body.error) {
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN_ERROR", body.error?.message ?? "Pembuatan prototipe gagal.");
  }
  return body.data as PrototypeVersion;
}

export async function getLatestPrototype(projectId: string): Promise<PrototypeVersion> {
  let res: Response;
  try {
    res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/design/prototype`);
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Tidak dapat menghubungi server lokal.");
  }
  const body = (await res.json()) as { data?: PrototypeVersion; error?: { code: string; message: string } };
  if (!res.ok || body.error) {
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN_ERROR", body.error?.message ?? "Prototipe tidak tersedia.");
  }
  return body.data as PrototypeVersion;
}

export function prototypeDownloadUrl(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/design/prototype/download`;
}

export async function fetchPrototypeHtml(projectId: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(prototypeDownloadUrl(projectId), { signal });
  if (!res.ok) throw new ApiError(res.status, "UNKNOWN_ERROR", "Prototipe tidak dapat dimuat.");
  return res.text();
}
export function friendlyDesignError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "DOCUMENT_NOT_FOUND") return "Belum ada prototipe. Buat dulu.";
    if (err.code === "NEED_APPROVED_BASELINE") return "Butuh PRD yang sudah disetujui. Setujui PRD dulu di Perencanaan.";
    return err.message;
  }
  return err instanceof Error ? err.message : "Terjadi kesalahan yang tidak dikenal.";
}
