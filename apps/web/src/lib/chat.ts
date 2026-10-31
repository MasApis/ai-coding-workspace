import type { ConversationDto, MessageDto } from "@workspace/shared";
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

export function listConversations(projectId: string): Promise<ConversationDto[]> {
  return request<{ items: ConversationDto[] }>(`/projects/${encodeURIComponent(projectId)}/conversations`).then((d) => d.items);
}

export function createConversation(projectId: string, title?: string): Promise<ConversationDto> {
  return request<ConversationDto>(`/projects/${encodeURIComponent(projectId)}/conversations`, {
    method: "POST",
    body: JSON.stringify(title ? { title } : {}),
  });
}

export function listMessages(conversationId: string): Promise<MessageDto[]> {
  return request<{ items: MessageDto[] }>(`/conversations/${encodeURIComponent(conversationId)}/messages`).then((d) => d.items);
}

export interface ContextDocRef {
  documentId: string;
  versionNo?: number;
}

export interface ChatStreamHandlers {
  onDelta: (text: string) => void;
  onError: (code: string, message: string) => void;
  onDone: (messageId?: string) => void;
  signal: AbortSignal;
}

export async function streamChatMessage(
  conversationId: string,
  contentMd: string,
  modelId: string | undefined,
  contextDocs: ContextDocRef[],
  handlers: ChatStreamHandlers,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/conversations/${encodeURIComponent(conversationId)}/messages/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentMd, ...(modelId ? { modelId } : {}), ...(contextDocs.length > 0 ? { contextDocs } : {}) }),
      signal: handlers.signal,
    });
  } catch (err) {
    if (handlers.signal.aborted) return;
    throw err instanceof Error ? err : new Error("network error");
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
    handlers.onError(body?.error?.code ?? "UNKNOWN_ERROR", body?.error?.message ?? "Pengiriman gagal.");
    return;
  }
  for await (const event of readSseEvents(res, handlers.signal)) {
    if (event.type === "delta" && typeof event.text === "string") handlers.onDelta(event.text);
    else if (event.type === "error") {
      handlers.onError(String(event.code ?? "UNKNOWN_ERROR"), String(event.message ?? "Terjadi kesalahan."));
      return;
    } else if (event.type === "complete") {
      handlers.onDone(typeof event.messageId === "string" ? event.messageId : undefined);
      return;
    } else if (event.type === "cancelled") {
      return;
    }
  }
}
