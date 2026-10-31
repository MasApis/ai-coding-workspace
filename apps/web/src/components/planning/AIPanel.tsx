import { useRef, useState } from "react";
import { Link } from "react-router";
import { Alert } from "../Alert.js";
import { Button } from "../Button.js";
import { Skeleton } from "../Skeleton.js";
import { TextArea } from "../TextField.js";
import { generateDocumentStream, friendlyDocumentError } from "../../lib/documents.js";
import { listDecisions, saveDecision } from "../../lib/decisions.js";
import { ApiError } from "../../lib/api.js";
import { getEffectiveSelection } from "../../lib/providers.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function AIPanel({
  projectId,
  docType,
  hasDoc,
  approved,
  onGenerated,
}: {
  projectId: string;
  docType: string;
  hasDoc: boolean;
  approved: boolean;
  onGenerated: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ section: string; done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [asking, setAsking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const selectionQuery = useQuery({ queryKey: ["ai-selection", projectId], queryFn: () => getEffectiveSelection(projectId) });
  const selection = selectionQuery.data ?? null;
  const decisionsQuery = useQuery({ queryKey: ["decisions", projectId], queryFn: () => listDecisions(projectId) });
  const savedAnswers = new Map((decisionsQuery.data ?? []).map((d) => [d.question, d.answer]));
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSaveAnswer(index: number, question: string): Promise<void> {
    const answer = (drafts[index] ?? "").trim();
    if (!answer || savingIndex !== null) return;
    setSavingIndex(index);
    setSaveError(null);
    try {
      await saveDecision(projectId, { question, answer });
      setDrafts((d) => {
        const next = { ...d };
        delete next[index];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["decisions", projectId] });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Jawaban gagal disimpan.");
    } finally {
      setSavingIndex(null);
    }
  }

  async function handleGenerate(fromApproved: boolean): Promise<void> {
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    setProgress(null);
    setError(null);
    try {
      await generateDocumentStream(projectId, docType, fromApproved, controller.signal, (event) => {
        if (event.type === "progress") {
          setProgress({ section: String(event.section ?? ""), done: Number(event.done ?? 0), total: Number(event.total ?? 0) });
        } else if (event.type === "error") {
          throw new Error(String(event.message ?? "Pembuatan gagal."));
        }
      });
      onGenerated();
    } catch (err) {
      if (controller.signal.aborted) {
        setError("Dibatalkan.");
      } else if (err instanceof ApiError) {
        setError(friendlyDocumentError(err));
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Pembuatan gagal.");
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  async function handleQuestions(): Promise<void> {
    setAsking(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/plan/questions`, { method: "POST" });
      const body = (await res.json()) as { data?: { questions: string[] }; error?: { code: string; message: string } };
      if (!res.ok || body.error) throw new Error(body.error?.message ?? "Gagal meminta pertanyaan.");
      setQuestions(body.data?.questions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal meminta pertanyaan.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold">Panel AI</h3>
      {selectionQuery.isPending && <Skeleton label="Memeriksa provider…" />}
      {!selectionQuery.isPending && !selection && (
        <Alert variant="empty" title="Belum ada provider">
          <Link to="/settings" className="font-medium text-accent hover:underline">
            Hubungkan di Pengaturan →
          </Link>
        </Alert>
      )}
      {selection && (
        <p className="text-xs text-ink-soft">
          Siap: <span className="font-mono">{selection.modelId}</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={generating || !selection} onClick={() => void handleGenerate(approved)}>
          {generating ? "Membuat…" : hasDoc ? "Generate ulang" : "Generate draf"}
        </Button>
        {generating && (
          <Button variant="secondary" onClick={() => abortRef.current?.abort()}>
            Batalkan
          </Button>
        )}
        <Button variant="secondary" disabled={asking || !selection} onClick={() => void handleQuestions()}>
          {asking ? "Meminta…" : "Minta pertanyaan"}
        </Button>
      </div>
      {approved && <p className="text-xs text-ink-soft">Dokumen approved: generate akan membuat draf baru.</p>}
      {progress && (
        <p role="status" className="text-xs">
          {progress.section} ({progress.done}/{progress.total})
        </p>
      )}
      {error && (
        <Alert variant="error" title="AI gagal">
          {error}
        </Alert>
      )}
      {saveError && (
        <Alert variant="error" title="Jawaban gagal disimpan">
          {saveError}
        </Alert>
      )}
      {questions && questions.length > 0 && (
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
          {questions.map((q, i) => {
            const saved = savedAnswers.get(q);
            return (
              <li key={i}>
                <p>{q}</p>
                {saved !== undefined ? (
                  <p className="mt-1 rounded-control bg-canvas p-2 text-xs text-ink-soft">Jawaban tersimpan: {saved}</p>
                ) : (
                  <div className="mt-1 flex flex-col gap-1">
                    <TextArea
                      label={`Jawaban untuk pertanyaan ${i + 1}`}
                      value={drafts[i] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [i]: e.target.value }))}
                      rows={2}
                      placeholder="Tulis jawaban… (boleh dikosongkan)"
                    />
                    <div>
                      <Button variant="secondary" disabled={!(drafts[i] ?? "").trim() || savingIndex !== null} onClick={() => void handleSaveAnswer(i, q)}>
                        {savingIndex === i ? "Menyimpan…" : "Simpan jawaban"}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
