import { useState } from "react";
import { Link } from "react-router";
import { Alert } from "../components/Alert.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { Select, TextInput } from "../components/TextField.js";
import { STARTER_TEMPLATES, filterTemplates, type StackFilter, type StarterTemplate } from "@workspace/shared";
import { downloadTemplateUrl, friendlyTemplateError, instantiateTemplate } from "../lib/templatesClient.js";
import { ApiError } from "../lib/api.js";
import { PageHeader } from "./PageBits.js";

export function TemplatesPage() {
  const [query, setQuery] = useState("");
  const [stack, setStack] = useState<StackFilter>("all");
  const [active, setActive] = useState<StarterTemplate | null>(null);
  const [name, setName] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [overwrite, setOverwrite] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<{ projectId: string; relativePath: string } | null>(null);
  const visible = filterTemplates(STARTER_TEMPLATES, query, stack);

  function openDialog(template: StarterTemplate): void {
    setActive(template);
    setName("");
    setVariables({});
    setOverwrite(false);
    setFormError(null);
    setResult(null);
  }

  async function handleInstantiate(): Promise<void> {
    if (!active || !name.trim() || pending) return;
    setPending(true);
    setFormError(null);
    try {
      const filled: Record<string, string> = {};
      for (const v of active.variables) {
        const value = (variables[v.name] ?? "").trim();
        if (value) filled[v.name] = value;
      }
      const out = await instantiateTemplate(active.id, { name: name.trim(), variables: filled, overwrite });
      setResult(out);
    } catch (err) {
      setFormError(err instanceof ApiError ? friendlyTemplateError(err) : "Instansiasi gagal.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Templat" description="Starter asli siap pakai — lisensi, isi berkas, dan variabel terlihat di depan." />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <TextInput label="Cari template" placeholder="Nama, deskripsi, stack…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select label="Stack" value={stack} onChange={(e) => setStack(e.target.value as StackFilter)}>
          <option value="all">Semua</option>
          <option value="HTML">HTML</option>
          <option value="React">React</option>
        </Select>
      </div>

      {visible.length === 0 && (
        <Alert variant="empty" title="Tidak ada template yang cocok">
          Ubah kata kunci atau filter stack.
        </Alert>
      )}

      <ul className="grid gap-4 md:grid-cols-2" aria-label={`Katalog template (${visible.length})`}>
        {visible.map((t) => (
          <li key={t.id} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{t.name}</h2>
              <Badge variant="accent">{t.stack}</Badge>
              <Badge variant="neutral">{t.license}</Badge>
            </div>
            <p className="text-sm text-ink-soft">{t.description}</p>
            <div>
              <h3 className="text-sm font-medium">Berkas ({t.files.length})</h3>
              <ul className="mt-1 flex flex-col gap-1">
                {t.files.map((f) => (
                  <li key={f.path} className="font-mono text-xs text-ink-soft">
                    {f.path}
                  </li>
                ))}
              </ul>
            </div>
            {t.variables.length > 0 && (
              <div>
                <h3 className="text-sm font-medium">Variabel</h3>
                <ul className="mt-1 flex flex-col gap-1">
                  {t.variables.map((v) => (
                    <li key={v.name} className="text-xs text-ink-soft">
                      <span className="font-mono">{v.name}</span> — {v.description} (default: <span className="font-mono">{v.defaultValue}</span>)
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => openDialog(t)}>Gunakan template</Button>
              <a
                href={downloadTemplateUrl(t.id)}
                download
                className="inline-flex min-h-[40px] items-center rounded-control border border-line px-4 text-sm font-medium text-ink hover:bg-canvas"
              >
                Unduh ZIP
              </a>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={active !== null}
        title={active ? `Gunakan ${active.name}` : "Gunakan template"}
        onClose={() => setActive(null)}
        confirmLabel={pending ? "Membuat…" : "Buat proyek + file"}
        onConfirm={() => void handleInstantiate()}
      >
        <div className="flex flex-col gap-4">
          <TextInput label="Nama proyek" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. toko-saya" />
          {active?.variables.map((v) => (
            <TextInput
              key={v.name}
              label={`${v.name} (default: ${v.defaultValue})`}
              value={variables[v.name] ?? ""}
              onChange={(e) => setVariables((prev) => ({ ...prev, [v.name]: e.target.value }))}
              placeholder={v.description}
            />
          ))}
          <label className="flex min-h-0 items-center gap-2 text-sm">
            <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="h-5 w-5 accent-[#4F46E5]" />
            Timpa target bila sudah ada
          </label>
          {formError && (
            <p role="alert" className="text-sm text-error">
              {formError}
            </p>
          )}
          {result && (
            <div className="rounded-control border border-line bg-canvas p-3 text-sm">
              <p>
                Proyek dibuat:{" "}
                <Link to={`/projects/${result.projectId}`} className="font-medium text-accent hover:underline">
                  buka proyek →
                </Link>
              </p>
              <p className="mt-1 font-mono text-xs break-all">File: {result.relativePath}</p>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
