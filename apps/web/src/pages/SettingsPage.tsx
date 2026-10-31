import { useRef, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ImportResult, ProviderDto } from "@workspace/shared";
import { Alert } from "../components/Alert.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { Skeleton } from "../components/Skeleton.js";
import { Select, TextInput } from "../components/TextField.js";
import { ProviderDialog, type ProviderFormValues } from "../components/settings/ProviderDialog.js";
import { ApiError } from "../lib/api.js";
import { backupDownloadUrl, friendlyBackupError, importBackup } from "../lib/backup.js";
import { clearFallback, getFallback, getUsage, setFallback } from "../lib/usage.js";
import { useProjects } from "../hooks/useProjects.js";
import {
  buildUpdatePayload,
  createProvider,
  deleteProvider,
  formatValidationDetails,
  friendlyProviderError,
  getGlobalPreference,
  listProviders,
  setGlobalPreference,
  updateProvider,
} from "../lib/providers.js";
import { PageHeader } from "./PageBits.js";

function BackupSection() {
  const { data: projects } = useProjects("all");
  const [projectId, setProjectId] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File | undefined): Promise<void> {
    setImportError(null);
    setImportResult(null);
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setImportError("Berkas terlalu besar (maks 10 MB).");
      return;
    }
    setImporting(true);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const result = await importBackup(parsed as never);
      setImportResult(result);
    } catch (err) {
      setImportError(friendlyBackupError(err));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <p className="text-sm text-ink-soft">
        Backup berisi data proyek (dokumen, tugas, percakapan, keputusan). Kredensial, konfigurasi provider global, dan berkas ekspor/prototipe tidak ikut.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Proyek untuk diekspor" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="" disabled>
            Pilih proyek…
          </option>
          {(projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <div className="flex items-end gap-2">
          {projectId && (
            <a
              href={backupDownloadUrl(projectId)}
              download
              className="inline-flex min-h-[40px] items-center rounded-control border border-line px-4 text-sm font-medium hover:bg-canvas"
            >
              Unduh backup
            </a>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="backup-file">
          Impor backup (JSON)
        </label>
        <input id="backup-file" ref={fileRef} type="file" accept="application/json,.json" disabled={importing} onChange={(e) => void handleFile(e.target.files?.[0])} className="text-sm" />
      </div>
      {importing && <p className="text-sm text-ink-soft">Mengimpor…</p>}
      {importError && (
        <Alert variant="error" title="Impor gagal">
          {importError}
        </Alert>
      )}
      {importResult && (
        <Alert variant="info" title="Impor selesai">
          Proyek baru:{" "}
          <Link to={`/projects/${importResult.projectId}`} className="font-medium text-accent hover:underline">
            {importResult.projectSlug} →
          </Link>{" "}
          ({importResult.counts.documents} dokumen, {importResult.counts.messages} pesan)
          {importResult.warnings.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {importResult.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}
    </div>
  );
}

function FallbackForm({
  providers,
  fallback,
  fallbackModel,
  onFallbackModel,
  onSave,
  onClear,
  saving,
}: {
  providers: ProviderDto[];
  fallback: { providerId: string; modelId: string } | null;
  fallbackModel: string;
  onFallbackModel: (value: string) => void;
  onSave: (providerId: string, modelId: string) => void;
  onClear: () => void;
  saving: boolean;
}) {
  return (
    <form
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const providerId = String(form.get("fallback-provider") ?? "");
        const modelId = fallbackModel.trim();
        if (providerId && modelId) onSave(providerId, modelId);
      }}
    >
      <h3 className="text-sm font-semibold">Cadangan bila provider utama tak tersedia (opsional)</h3>
      {fallback ? (
        <p className="text-sm text-ink-soft">
          Aktif: <span className="font-mono">{fallback.modelId}</span> pada provider{" "}
          <span className="font-mono">{providers.find((p) => p.id === fallback.providerId)?.label ?? fallback.providerId}</span>
        </p>
      ) : (
        <p className="text-sm text-ink-soft">Mati. Tanpa cadangan, permintaan gagal jujur bila provider utama hilang.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Provider cadangan" name="fallback-provider" defaultValue={fallback?.providerId ?? ""}>
          <option value="" disabled>
            Pilih provider…
          </option>
          {providers
            .filter((p) => p.enabled)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
        </Select>
        <TextInput label="ID Model cadangan" value={fallbackModel} onChange={(e) => onFallbackModel(e.target.value)} placeholder="cth. llama3" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="secondary" disabled={!fallbackModel.trim() || saving}>
          {saving ? "Menyimpan…" : "Simpan cadangan"}
        </Button>
        {fallback && (
          <Button type="button" variant="ghost" onClick={onClear}>
            Matikan
          </Button>
        )}
      </div>
    </form>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderDto | null>(null);
  const [deleting, setDeleting] = useState<ProviderDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formDetails, setFormDetails] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState("");
  const [fallbackModel, setFallbackModel] = useState("");

  const providersQuery = useQuery({ queryKey: ["providers"], queryFn: listProviders });
  const prefQuery = useQuery({ queryKey: ["ai-preferences"], queryFn: getGlobalPreference });
  const fallbackQuery = useQuery({ queryKey: ["ai-fallback"], queryFn: getFallback });

  async function refresh(): Promise<void> {
    setFormError(null);
    setFormDetails([]);
    await queryClient.invalidateQueries({ queryKey: ["providers"] });
    await queryClient.invalidateQueries({ queryKey: ["ai-preferences"] });
    await queryClient.invalidateQueries({ queryKey: ["ai-fallback"] });
  }

  const saveMutation = useMutation({
    mutationFn: (values: ProviderFormValues) => {
      if (editing) {
        return updateProvider(editing.id, buildUpdatePayload(values));
      }
      const payload = {
        label: values.label,
        protocol: values.protocol,
        baseUrl: values.baseUrl || undefined,
        enabled: values.enabled,
        ...(values.credential ? { credential: values.credential } : {}),
      };
      return createProvider(payload);
    },
    onSuccess: () => {
      setDialogOpen(false);
      setEditing(null);
      void refresh();
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? friendlyProviderError(err.code, err.message) : "Penyimpanan gagal.");
      setFormDetails(err instanceof ApiError ? formatValidationDetails(err) : []);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProvider(id),
    onSuccess: () => {
      setDeleting(null);
      void refresh();
    },
    onError: (err) => setFormError(err instanceof ApiError ? friendlyProviderError(err.code, err.message) : "Penghapusan gagal."),
  });

  const toggleMutation = useMutation({
    mutationFn: (p: ProviderDto) => updateProvider(p.id, { enabled: !p.enabled }),
    onSuccess: () => void refresh(),
    onError: (err) => setFormError(err instanceof ApiError ? friendlyProviderError(err.code, err.message) : "Perubahan status gagal."),
  });

  const defaultMutation = useMutation({
    mutationFn: ({ providerId, modelId }: { providerId: string; modelId: string }) => setGlobalPreference(providerId, modelId),
    onSuccess: () => void refresh(),
    onError: (err) => setFormError(err instanceof ApiError ? friendlyProviderError(err.code, err.message) : "Penyimpanan default gagal."),
  });

  const fallbackMutation = useMutation({
    mutationFn: ({ providerId, modelId }: { providerId: string; modelId: string }) => setFallback(providerId, modelId),
    onSuccess: () => void refresh(),
    onError: (err) => setFormError(err instanceof ApiError ? friendlyProviderError(err.code, err.message) : "Penyimpanan fallback gagal."),
  });

  const clearFallbackMutation = useMutation({
    mutationFn: () => clearFallback(),
    onSuccess: () => void refresh(),
    onError: (err) => setFormError(err instanceof ApiError ? friendlyProviderError(err.code, err.message) : "Penghapusan fallback gagal."),
  });

  const providers = providersQuery.data ?? [];
  const preference = prefQuery.data ?? null;
  const fallback = fallbackQuery.data ?? null;

  return (
    <div>
      <PageHeader title="Pengaturan" description="Provider AI, penyimpanan, dan keamanan." />

      <section aria-labelledby="s-ai" className="mb-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="s-ai" className="text-lg font-semibold">Provider AI</h2>
          <Button
            variant="secondary"
            onClick={() => {
              setEditing(null);
              setFormError(null);
              setDialogOpen(true);
            }}
          >
            Tambah provider
          </Button>
        </div>

        {formError && (
          <Alert variant="error" title="Gagal">
            {formError}
          </Alert>
        )}

        {providersQuery.isPending && <Skeleton label="Memuat provider…" />}
        {providersQuery.isError && (
          <Alert variant="error" title="Provider tidak dapat dimuat">
            {friendlyProviderError("NETWORK_ERROR")}
          </Alert>
        )}

        {!providersQuery.isPending && !providersQuery.isError && providers.length === 0 && (
          <Alert variant="empty" title="Belum ada provider">
            Tambahkan provider AI agar Planning dan Chat bisa digunakan. Kunci hanya tersimpan di server lokal dan tidak pernah ditampilkan kembali.
          </Alert>
        )}

        {providers.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label={`Daftar provider (${providers.length})`}>
            {providers.map((p) => {
              const isDefault = preference?.providerId === p.id;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {p.label} {isDefault && <span className="text-xs font-normal text-accent">(default)</span>}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1 text-xs text-ink-soft">
                      <Badge variant={p.enabled ? "accent" : "neutral"}>{p.protocol}</Badge>
                      {!p.enabled && <Badge variant="warning">Nonaktif</Badge>}
                      {p.hasCredential && <Badge variant="success">Kunci tersimpan</Badge>}
                    </p>
                    {p.baseUrl && <p className="mt-1 truncate font-mono text-xs text-ink-soft">{p.baseUrl}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditing(p);
                        setFormError(null);
                        setDialogOpen(true);
                      }}
                    >
                      Ubah / Test
                    </Button>
                    <Button variant="secondary" onClick={() => toggleMutation.mutate(p)}>
                      {p.enabled ? "Nonaktifkan" : "Aktifkan"}
                    </Button>
                    <Button variant="destructive" onClick={() => setDeleting(p)}>
                      Hapus
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {providers.length > 0 && (
          <form
            className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const providerId = String(form.get("provider") ?? "");
              const modelId = String(form.get("model") ?? "").trim();
              if (providerId && modelId) defaultMutation.mutate({ providerId, modelId });
            }}
          >
            <h3 className="text-sm font-semibold">Default global</h3>
            {preference ? (
              <p className="text-sm text-ink-soft">
                Aktif: <span className="font-mono">{preference.modelId}</span> pada provider{" "}
                <span className="font-mono">{providers.find((p) => p.id === preference.providerId)?.label ?? preference.providerId}</span>
              </p>
            ) : (
              <p className="text-sm text-ink-soft">Belum ada default. Planning dan Chat membutuhkannya.</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Provider" name="provider" defaultValue={preference?.providerId ?? ""}>
                <option value="" disabled>
                  Pilih provider…
                </option>
                {providers
                  .filter((p) => p.enabled)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
              </Select>
              <TextInput
                label="ID Model"
                name="model"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                placeholder="cth. llama3 / gpt-4o-mini"
              />
            </div>
            <div>
              <Button type="submit" variant="secondary" disabled={!defaultModel.trim()}>
                Simpan default
              </Button>
            </div>
          </form>
        )}
        {providers.length > 0 && (
          <FallbackForm
            providers={providers}
            fallback={fallback}
            fallbackModel={fallbackModel}
            onFallbackModel={setFallbackModel}
            onSave={(providerId, modelId) => fallbackMutation.mutate({ providerId, modelId })}
            onClear={() => clearFallbackMutation.mutate()}
            saving={fallbackMutation.isPending}
          />
        )}
      </section>

      <section aria-labelledby="s-storage" className="flex flex-col gap-4">
        <h2 id="s-storage" className="text-lg font-semibold">Penyimpanan</h2>
        <BackupSection />
      </section>

      <ProviderDialog
        open={dialogOpen}
        initial={editing}
        pending={saveMutation.isPending}
        error={formError}
        errorDetails={formDetails}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
        onSubmit={(values) => saveMutation.mutate(values)}
      />

      <Dialog
        open={deleting !== null}
        title="Hapus provider?"
        onClose={() => setDeleting(null)}
        confirmLabel="Ya, hapus"
        destructive
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      >
        <p>
          Provider “{deleting?.label}” beserta kunci dan preferensi yang merujuknya akan dihapus. Tindakan ini tidak dapat
          dibatalkan.
        </p>
      </Dialog>
    </div>
  );
}
