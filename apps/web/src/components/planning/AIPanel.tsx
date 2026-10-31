import { useRef, useState } from "react";
import { Link } from "react-router";
import { Alert } from "../Alert.js";
import { Button } from "../Button.js";
import { Skeleton } from "../Skeleton.js";
import { generateDocumentStream, friendlyDocumentError } from "../../lib/documents.js";
import { ApiError } from "../../lib/api.js";
import { getEffectiveSelection } from "../../lib/providers.js";
import { useQuery } from "@tanstack/react-query";

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
  const selectionQuery = useQuery({ queryKey: ["ai-selection", projectId], queryFn: () => getEffectiveSelection(projectId) });
  const selection = selectionQuery.data ?? null;

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
      {questions && questions.length > 0 && (
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
          {questions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
