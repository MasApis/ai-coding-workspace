import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ProviderDto, ProviderProtocol } from "@workspace/shared";
import { Button } from "../Button.js";
import { Dialog } from "../Dialog.js";
import { Select, TextInput } from "../TextField.js";
import { friendlyProviderError, listModels, testProvider, type ConnectionTest } from "../../lib/providers.js";
import { ApiError } from "../../lib/api.js";

const PROTOCOLS: ProviderProtocol[] = ["openai-compatible", "openai", "anthropic", "gemini", "ollama"];

export interface ProviderFormValues {
  label: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  credential: string;
  removeCredential: boolean;
  enabled: boolean;
  testModel: string;
}

export function ProviderDialog({
  open,
  initial,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial: ProviderDto | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (values: ProviderFormValues) => void;
}) {
  const [label, setLabel] = useState("");
  const [protocol, setProtocol] = useState<ProviderProtocol>("openai-compatible");
  const [baseUrl, setBaseUrl] = useState("");
  const [credential, setCredential] = useState("");
  const [changingKey, setChangingKey] = useState(false);
  const [removeKey, setRemoveKey] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [testModel, setTestModel] = useState("");
  const [testResult, setTestResult] = useState<ConnectionTest | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(initial?.label ?? "");
      setProtocol(initial?.protocol ?? "openai-compatible");
      setBaseUrl(initial?.baseUrl ?? "");
      setCredential("");
      setChangingKey(initial === null);
      setRemoveKey(false);
      setEnabled(initial?.enabled ?? true);
      setTestModel("");
      setTestResult(null);
      setTestError(null);
    }
  }, [open, initial]);

  const { data: models } = useQuery({
    queryKey: ["provider-models", initial?.id],
    queryFn: () => listModels(initial?.id ?? ""),
    enabled: open && initial !== null,
    staleTime: 30000,
  });

  async function handleTest(): Promise<void> {
    if (!initial) return;
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      setTestResult(await testProvider(initial.id, testModel.trim() || undefined));
    } catch (err) {
      setTestError(err instanceof ApiError ? friendlyProviderError(err.code, err.message) : "Test gagal.");
    } finally {
      setTesting(false);
    }
  }

  const canSave = label.trim().length > 0;

  return (
    <Dialog
      open={open}
      title={initial ? "Ubah provider" : "Tambah provider"}
      onClose={onClose}
      confirmLabel={pending ? "Menyimpan…" : "Simpan"}
      onConfirm={() => {
        if (canSave) onSubmit({ label: label.trim(), protocol, baseUrl: baseUrl.trim(), credential, removeCredential: removeKey, enabled, testModel: testModel.trim() });
      }}
    >
      <div className="flex flex-col gap-4">
        <TextInput label="Label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="cth. Router lokal" />
        <Select label="Protokol" value={protocol} onChange={(e) => setProtocol(e.target.value as ProviderProtocol)} disabled={initial !== null}>
          {PROTOCOLS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <TextInput
          label="Base URL"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://… atau http://127.0.0.1:11434"
          hint="HTTPS untuk remote; HTTP hanya untuk loopback."
        />
        {initial === null || changingKey ? (
          <TextInput
            label={initial ? "Kredensial baru" : "Kredensial (API key)"}
            type="password"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder={initial ? "Tempel kunci baru di sini" : "sk-…"}
            hint="Tidak pernah ditampilkan kembali setelah disimpan."
            autoComplete="off"
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-canvas px-3 py-2 text-sm">
            <span aria-label="Kunci tersimpan">Kunci tersimpan ••••••••</span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setChangingKey(true); setRemoveKey(false); }}>
                Ganti kunci
              </Button>
              {initial.hasCredential && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRemoveKey((v) => !v);
                    setCredential("");
                  }}
                  aria-pressed={removeKey}
                >
                  {removeKey ? "Batal hapus kunci" : "Hapus kunci"}
                </Button>
              )}
            </div>
          </div>
        )}
        {changingKey && initial !== null && (
          <div>
            <Button
              variant="ghost"
              onClick={() => {
                setChangingKey(false);
                setCredential("");
                setRemoveKey(false);
              }}
            >
              Batal ganti
            </Button>
          </div>
        )}
        <label className="flex min-h-0 items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-5 w-5 accent-[#4F46E5]" />
          Aktif
        </label>

        {initial && (
          <div className="flex flex-col gap-2 rounded-control border border-line bg-canvas p-3">
            <TextInput
              label="Model untuk uji koneksi"
              value={testModel}
              onChange={(e) => setTestModel(e.target.value)}
              placeholder="cth. llama3 — boleh dikosongkan"
              list="model-presets"
            />
            {models?.modelsAvailable && models.items.length > 0 && (
              <datalist id="model-presets">
                {models.items.map((m) => (
                  <option key={m.id} value={m.id} />
                ))}
              </datalist>
            )}
            <div>
              <Button variant="secondary" onClick={() => void handleTest()} disabled={testing}>
                {testing ? "Menguji…" : "Test koneksi"}
              </Button>
            </div>
            {testResult && (
              <p role="status" className={`text-sm ${testResult.ok ? "text-success" : "text-error"}`}>
                {testResult.ok ? "✓ " : "✕ "}{testResult.message}
              </p>
            )}
            {testError && (
              <p role="alert" className="text-sm text-error">
                {testError}
              </p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
