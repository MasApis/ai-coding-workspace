import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "../components/Alert.js";
import { Button } from "../components/Button.js";
import { AudienceStep } from "../components/wizard/AudienceStep.js";
import { ConstraintsStep } from "../components/wizard/ConstraintsStep.js";
import { IdeaStep } from "../components/wizard/IdeaStep.js";
import { ReviewStep } from "../components/wizard/ReviewStep.js";
import { ApiError, createProject } from "../lib/api.js";
import { EMPTY_DRAFT, STEP_TITLES, buildDescription, canProceed, type WizardDraft } from "../lib/wizard.js";
import { PageHeader } from "./PageBits.js";

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "PROJECT_SLUG_TAKEN") return "Nama tersebut sudah dipakai. Ubah sedikit lalu coba lagi.";
    if (err.code === "VALIDATION_ERROR") return "Periksa isian: nama wajib diisi dan tidak terlalu panjang.";
    return err.message;
  }
  return "Terjadi kesalahan yang tidak dikenal.";
}

export function NewProjectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>(EMPTY_DRAFT);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const mutation = useMutation({
    mutationFn: () =>
      createProject({
        name: draft.name.trim(),
        description: buildDescription(draft),
        ideaMd: draft.idea.trim() || undefined,
      }),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void navigate(`/projects/${project.id}`);
    },
    onError: (err) => setSubmitError(friendlyError(err)),
  });

  function patch(p: Partial<WizardDraft>): void {
    setDraft((d) => ({ ...d, ...p }));
  }

  const last = step === STEP_TITLES.length - 1;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Proyek baru" description={`Langkah ${step + 1} dari ${STEP_TITLES.length}: ${STEP_TITLES[step]}`} />

      <ol aria-label="Kemajuan" className="mb-6 flex gap-2">
        {STEP_TITLES.map((title, i) => (
          <li key={title} className="flex-1">
            <span
              aria-current={i === step ? "step" : undefined}
              className={`block rounded-full px-2 py-1 text-center text-xs font-medium ${
                i === step ? "bg-accent-soft text-accent" : i < step ? "bg-canvas text-ink" : "bg-canvas text-ink-soft"
              }`}
            >
              {title}
            </span>
          </li>
        ))}
      </ol>

      <h2 ref={headingRef} tabIndex={-1} className="mb-4 text-lg font-semibold outline-none">
        {STEP_TITLES[step]}
      </h2>

      {step === 0 && <IdeaStep draft={draft} onChange={patch} />}
      {step === 1 && <AudienceStep draft={draft} onChange={patch} />}
      {step === 2 && <ConstraintsStep draft={draft} onChange={patch} />}
      {step === 3 && <ReviewStep draft={draft} />}

      {submitError && (
        <div className="mt-4">
          <Alert variant="error" title="Proyek tidak dapat dibuat">
            {submitError}
          </Alert>
        </div>
      )}

      <div className="mt-6 flex justify-between gap-2">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Kembali
        </Button>
        {!last && (
          <Button disabled={!canProceed(step, draft)} onClick={() => setStep((s) => s + 1)}>
            Lanjut
          </Button>
        )}
        {last && (
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Menyimpan…" : "Buat proyek"}
          </Button>
        )}
      </div>
    </div>
  );
}
