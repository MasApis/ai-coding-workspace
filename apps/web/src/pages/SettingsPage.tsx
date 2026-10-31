import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProviderDto } from "@workspace/shared";
import { Alert } from "../components/Alert.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { Skeleton } from "../components/Skeleton.js";
import { Select, TextInput } from "../components/TextField.js";
import { ProviderDialog, type ProviderFormValues } from "../components/settings/ProviderDialog.js";
import { ApiError } from "../lib/api.js";
import {
  createProvider,
  deleteProvider,
  friendlyProviderError,
  getGlobalPreference,
  listProviders,
  setGlobalPreference,
  updateProvider,
} from "../lib/providers.js";
import { PageHeader, TicketNote } from "./PageBits.js";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProviderDto | null>(null);
  const [deleting, setDeleting] = useState<ProviderDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [defaultModel, setDefaultModel] = useState("");

  const providersQuery = useQuery({ queryKey: ["providers"], queryFn: listProviders });
  const prefQuery = useQuery({ queryKey: ["ai-preferences"], queryFn: getGlobalPreference });

  async function refresh(): Promise<void> {
    setFormError(null);
    await queryClient.invalidateQueries({ queryKey: ["providers"] });
    await queryClient.invalidateQueries({ queryKey: ["ai-preferences"] });
  }

  const saveMutation = useMutation({
    mutationFn: (values: ProviderFormValues) => {
      const payload = {
        label: values.label,
        protocol: values.protocol,
        baseUrl: values.baseUrl || undefined,
        enabled: values.enabled,
        ...(values.credential ? { credential: values.credential } : {}),
      };
      return editing ? updateProvider(editing.id, payload) : createProvider(payload);
    },
    onSuccess: () => {
      setDialogOpen(false);
      setEditing(null);
      void refresh();
    },
    onError: (err) => setFormError(err instanceof ApiError ? friendlyProviderError(err.code, err.message) : "Penyimpanan gagal."),
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

  const providers = providersQuery.data ?? [];
  const preference = prefQuery.data ?? null;

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
      </section>

      <section aria-labelledby="s-storage" className="flex flex-col gap-4">
        <h2 id="s-storage" className="text-lg font-semibold">Penyimpanan</h2>
        <TicketNote ticket="TICKET-021">Manajemen direktori data, backup/restore, dan aksi hapus data.</TicketNote>
      </section>

      <ProviderDialog
        open={dialogOpen}
        initial={editing}
        pending={saveMutation.isPending}
        error={formError}
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
