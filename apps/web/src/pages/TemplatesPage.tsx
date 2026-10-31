import { useState } from "react";
import { Alert } from "../components/Alert.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Select, TextInput } from "../components/TextField.js";
import { STARTER_TEMPLATES, filterTemplates, type StackFilter } from "../lib/templates/index.js";
import { PageHeader } from "./PageBits.js";

export function TemplatesPage() {
  const [query, setQuery] = useState("");
  const [stack, setStack] = useState<StackFilter>("all");
  const visible = filterTemplates(STARTER_TEMPLATES, query, stack);

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
            <div>
              <Button disabled title="Pembuatan proyek dari template hadir di TICKET-020">
                Gunakan template
              </Button>
              <p className="mt-1 text-xs text-ink-soft">Instansiasi ke folder baru hadir di TICKET-020.</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
