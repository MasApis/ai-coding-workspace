import { useEffect, useState } from "react";
import { Markdown } from "../Markdown.js";

// Assistant replies are markdown; rendering them as plain text hid every list,
// table and code block the model produced. Markdown sanitizes the HTML.
export function AssistantMessage({
  contentMd,
  modelId,
  contextLabel,
  onInsert,
}: {
  contentMd: string;
  modelId?: string | null;
  contextLabel?: string | null;
  onInsert: (text: string) => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = setTimeout(() => setCopyState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copyState]);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(contentMd);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="max-w-[85%] self-start rounded-card bg-canvas p-3 text-sm">
      <p className="mb-1 text-xs font-medium text-ink-soft">AI{modelId ? ` · ${modelId}` : ""}</p>
      <Markdown source={contentMd} label="Balasan AI" />
      {contextLabel && <p className="mt-2 text-xs text-ink-soft">Konteks: {contextLabel}</p>}
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        <button type="button" onClick={() => void handleCopy()} className="text-ink-soft underline hover:text-ink">
          {copyState === "copied" ? "Tersalin" : copyState === "failed" ? "Gagal menyalin" : "Salin"}
        </button>
        <button type="button" onClick={() => onInsert(contentMd)} className="text-ink-soft underline hover:text-ink">
          Masukkan ke pesan
        </button>
      </div>
    </div>
  );
}
