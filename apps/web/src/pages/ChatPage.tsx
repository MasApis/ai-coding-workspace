import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "../components/Alert.js";
import { EmptyState } from "../components/EmptyState.js";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { Skeleton } from "../components/Skeleton.js";
import { AssistantMessage } from "../components/chat/AssistantMessage.js";
import { ModelPicker } from "../components/chat/ModelPicker.js";
import { ApiError } from "../lib/api.js";
import { createConversation, listConversations, listMessages, streamChatMessage, type ContextDocRef } from "../lib/chat.js";
import { getEffectiveSelection } from "../lib/providers.js";
import { getUsage } from "../lib/usage.js";
import { listDocuments } from "../lib/documents.js";

export function ChatPage() {
  const { projectId, conversationId } = useParams();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(conversationId ?? null);
  const [draft, setDraft] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastContent, setLastContent] = useState<string | null>(null);
  const [modelOverride, setModelOverride] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<ContextDocRef[]>([]);
  const [pendingInsert, setPendingInsert] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveId(conversationId ?? null);
  }, [conversationId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const conversationsQuery = useQuery({
    queryKey: ["conversations", projectId],
    queryFn: () => listConversations(projectId ?? ""),
    enabled: !!projectId,
  });
  const conversations = conversationsQuery.data ?? [];

  const messagesQuery = useQuery({
    queryKey: ["messages", activeId],
    queryFn: () => listMessages(activeId ?? ""),
    enabled: !!activeId,
  });
  const messages = messagesQuery.data ?? [];

  const selectionQuery = useQuery({ queryKey: ["ai-selection", projectId], queryFn: () => getEffectiveSelection(projectId), enabled: !!projectId });
  const selection = selectionQuery.data ?? null;

  const usageQuery = useQuery({ queryKey: ["ai-usage", projectId], queryFn: () => getUsage(projectId), enabled: !!projectId, staleTime: 10000 });
  const usage = usageQuery.data ?? null;

  const docsQuery = useQuery({ queryKey: ["documents", projectId], queryFn: () => listDocuments(projectId ?? ""), enabled: !!projectId });
  const docs = docsQuery.data ?? [];

  const docById = new Map(docs.map((d) => [d.id, d]));

  function contextLabel(upstream: Array<{ documentId: string; versionNo: number }>): string {
    return upstream.map((u) => `${docById.get(u.documentId)?.title ?? u.documentId} v${u.versionNo}`).join(", ");
  }

  function handleInsert(text: string): void {
    // Inserting replaces the draft only with explicit confirmation, because
    // an AI reply can be long and wiping a typed draft would lose work.
    if (!draft.trim()) {
      setDraft(text);
      return;
    }
    setPendingInsert(text);
  }

  function toggleDoc(documentId: string): void {
    setSelectedDocs((prev) => {
      const doc = docById.get(documentId);
      if (!doc || doc.currentVersionNo === null) return prev;
      if (prev.some((d) => d.documentId === documentId)) {
        return prev.filter((d) => d.documentId !== documentId);
      }
      return [...prev, { documentId, versionNo: doc.currentVersionNo }];
    });
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, streamingText]);

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ["conversations", projectId] });
    await queryClient.invalidateQueries({ queryKey: ["messages", activeId] });
    await queryClient.invalidateQueries({ queryKey: ["ai-usage", projectId] });
  }

  async function send(content: string): Promise<void> {
    if (!projectId || streaming || !content.trim()) return;
    setChatError(null);
    setStreamingText("");
    const controller = new AbortController();
    abortRef.current = controller;
    let targetId = activeId;
    try {
      if (!targetId) {
        const created = await createConversation(projectId, content.trim().slice(0, 40));
        targetId = created.id;
        setActiveId(targetId);
      }
      setLastContent(content);
      setDraft("");
      setStreaming(true);
      const override = modelOverride.trim() || undefined;
      await streamChatMessage(targetId, content.trim(), override, selectedDocs, {
        signal: controller.signal,
        onDelta: (text) => setStreamingText((t) => t + text),
        onError: (code, message) => setChatError(code === "NO_PROVIDER_CONFIGURED" ? "Belum ada provider. Hubungkan di Pengaturan." : message),
        onDone: () => void refresh(),
      });
    } catch (err) {
      if (!controller.signal.aborted) {
        setChatError(err instanceof ApiError ? err.message : "Pengiriman gagal.");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      await refresh();
    }
  }

  if (!projectId) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState title="Belum ada konteks proyek">
          Chat terikat pada proyek agar riwayat tersimpan dengan benar.
        </EmptyState>
        <Link to="/projects" className="text-sm text-ink hover:underline">
          ← Pilih proyek
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Chat AI</h2>
          <p className="mt-1 text-sm text-ink-soft">
            {selection ? (
              <>
                Model: <span className="font-mono">{modelOverride.trim() || selection.modelId}</span>
              </>
            ) : (
              "Pilih atau mulai percakapan."
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Link to="/settings" className="text-sm text-ink hover:underline">
            Ubah bawaan →
          </Link>
          {usage && (usage.requests > 0 || usage.errors > 0) && (
            <p className="text-xs text-ink-soft" role="status">
              Proyek ini: {usage.requests} permintaan AI, {usage.errors} gagal
            </p>
          )}
        </div>
      </div>

      {!selection && !selectionQuery.isPending && (
        <div className="mb-4">
          <EmptyState title="Belum ada provider AI">
            Hubungkan provider di Pengaturan agar Chat bisa digunakan.{" "}
            <Link to="/settings" className="font-medium text-ink hover:underline">
              Buka Pengaturan →
            </Link>
          </EmptyState>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <section aria-label="Percakapan" className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Percakapan</h2>
          {conversationsQuery.isPending && <Skeleton label="Memuat percakapan…" />}
          <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto md:max-h-none">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  aria-current={activeId === c.id ? "true" : undefined}
                  className={`w-full rounded-control px-3 py-2 text-left text-sm ${activeId === c.id ? "bg-accent-soft font-medium text-accent" : "hover:bg-canvas"}`}
                >
                  {c.title ?? "Tanpa judul"}
                </button>
              </li>
            ))}
          </ul>
          <Button
            variant="secondary"
            onClick={() => {
              setActiveId(null);
              setDraft("");
              setStreamingText("");
              setChatError(null);
            }}
          >
            + Percakapan baru
          </Button>
        </section>

        <section aria-label="Pesan" className="flex min-h-[50vh] flex-col gap-3 rounded-card border border-line bg-surface p-4">
          <div ref={listRef} className="flex max-h-[50vh] min-h-[30vh] flex-col gap-3 overflow-y-auto" aria-live="polite">
            {!activeId && messages.length === 0 && !streamingText && (
              <EmptyState title="Mulai percakapan">
                Tulis pesan pertama di bawah. Percakapan baru dibuat otomatis.
              </EmptyState>
            )}
            {activeId && messagesQuery.isPending && <Skeleton label="Memuat pesan…" />}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="max-w-[85%] self-end rounded-card bg-accent-soft p-3 text-sm">
                  <p className="mb-1 text-xs font-medium text-ink-soft">
                    Anda
                    {m.modelId ? (
                      <>
                        {" "}· <span className="font-mono">{m.modelId}</span>
                      </>
                    ) : (
                      ""
                    )}
                  </p>
                  <p className="whitespace-pre-wrap">{m.contentMd}</p>
                </div>
              ) : (
                <AssistantMessage
                  key={m.id}
                  contentMd={m.contentMd}
                  modelId={m.modelId}
                  contextLabel={m.contextManifest && m.contextManifest.upstream.length > 0 ? contextLabel(m.contextManifest.upstream) : null}
                  onInsert={handleInsert}
                />
              ),
            )}
            {streamingText && (
              <div className="max-w-[85%] self-start rounded-card bg-canvas p-3 text-sm">
                <p className="mb-1 text-xs font-medium text-ink-soft">AI</p>
                <p className="whitespace-pre-wrap">{streamingText}</p>
              </div>
            )}
          </div>

          {chatError && (
            <div className="flex flex-col gap-2">
              <Alert variant="error" title="Pesan gagal">
                {chatError}
              </Alert>
              {lastContent && !streaming && (
                <div>
                  <Button variant="secondary" onClick={() => void send(lastContent)}>
                    Coba lagi
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <fieldset>
              <legend className="text-sm font-medium">Konteks dokumen (opsional)</legend>
              {docs.length === 0 && <p className="text-xs text-ink-soft">Belum ada dokumen di proyek ini.</p>}
              <div className="mt-1 flex flex-wrap gap-2">
                {docs.filter((d) => d.currentVersionNo !== null).map((d) => {
                  const checked = selectedDocs.some((s) => s.documentId === d.id);
                  return (
                    <label key={d.id} className="flex min-h-0 items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs">
                      <input type="checkbox" checked={checked} onChange={() => toggleDoc(d.id)} className="h-4 w-4 accent-[#4F46E5]" />
                      {d.title} v{d.currentVersionNo}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            {selection && (
              <ModelPicker
                providerId={selection.providerId}
                defaultModelId={selection.modelId}
                value={modelOverride}
                onChange={setModelOverride}
                disabled={streaming}
              />
            )}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Pesan</span>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(draft);
                  }
                }}
                rows={3}
                disabled={streaming || !selection}
                placeholder={selection ? "Tulis pesan… (Enter kirim, Shift+Enter baris baru)" : "Hubungkan provider dulu di Pengaturan"}
                className="w-full rounded-control border border-line bg-surface p-3 text-sm disabled:opacity-50"
              />
            </label>
            <div className="flex gap-2">
              {!streaming ? (
                <Button onClick={() => void send(draft)} disabled={!draft.trim() || !selection}>
                  Kirim
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => abortRef.current?.abort()}>
                  Stop
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>

      <Dialog
        open={pendingInsert !== null}
        title="Ganti draf pesan?"
        onClose={() => setPendingInsert(null)}
        confirmLabel="Ya, ganti"
        onConfirm={() => {
          if (pendingInsert !== null) setDraft(pendingInsert);
          setPendingInsert(null);
        }}
      >
        <p>
          Draf yang sedang Anda tulis akan diganti dengan balasan AI. Lanjutkan?
        </p>
      </Dialog>
    </div>
  );
}
