# AI Coding Workspace

Ruang kerja perencanaan software lokal-pertama (*local-first*): tulis ide, susun dokumen perencanaan (Brief → PRD → Alur Pengguna → Spesifikasi Teknis → Rencana Uji → Tugas & AGENTS) dengan bantuan AI, lalu ekspor semuanya sebagai paket ZIP yang siap dikerjakan.

Berjalan sepenuhnya di mesin Anda — frontend React, backend Fastify + SQLite. Tanpa akun, tanpa server cloud milik kami.

## Fitur utama

- **Perencanaan berbantuan AI** — generate draf dokumen dari provider AI pilihan Anda, tinjau dulu perbedaannya sebelum menyimpan, lalu kunci lewat alur review → setujui.
- **Provider AI bebas** — OpenAI-compatible, OpenAI, Anthropic, Gemini, atau Ollama lokal. Indikator jujur menunjukkan apakah inferensi berjalan **Lokal** atau **Remote**.
- **Chat per proyek** — percakapan terikat proyek, dengan konteks dokumen pilihan dan pilihan model per pesan.
- **Desain Studio** — brief, sitemap, layar, token, dan pratinjau prototipe terisolasi (*sandbox*).
- **Ekspor ZIP** — seluruh dokumen yang disetujui + manifest, siap dibawa ke tool coding favorit Anda.
- **Template starter** — mulai proyek baru dari template bawaan.

## Mulai cepat

Syarat: **Node.js 22** dan **pnpm**.

```bash
pnpm install       # instal dependensi (sekali saja)
pnpm db:migrate    # siapkan database SQLite lokal (sekali saja)
pnpm dev           # jalankan API + web sekaligus
```

Buka **http://127.0.0.1:5173**.

| Layanan | Alamat | Keterangan |
|---|---|---|
| Web (Vite) | `http://127.0.0.1:5173` | UI utama; `/api` di-proxy ke backend |
| API (Fastify) | `http://127.0.0.1:3001` | REST + SSE streaming, tanpa auth (localhost saja) |

### Menghubungkan AI (opsional tapi disarankan)

Tanpa provider AI, aplikasi tetap berjalan — fitur generate dan chat menampilkan empty state. Untuk mengaktifkannya:

1. Buka halaman **Pengaturan**.
2. Tambah provider (mis. endpoint OpenAI-compatible seperti Groq, atau Ollama di `http://127.0.0.1:11434`).
3. Simpan **bawaan global** (provider + model ID).

## Konfigurasi

Semua lewat environment variable (lihat `.env.example`). Nilai default cukup untuk jalan lokal.

| Variabel | Default | Keterangan |
|---|---|---|
| `API_HOST` / `API_PORT` | `127.0.0.1` / `3001` | Alamat listen API |
| `DB_PATH` | `./data/workspace.sqlite` | Lokasi database SQLite (relatif terhadap `apps/api`) |
| `EXPORT_DIR` | `./data/exports` | Tempat file ZIP hasil ekspor |
| `AI_GATEWAY_KEY` | *(dibuat otomatis)* | Kunci enkripsi kredensial provider; tersimpan di `./data/.keys/ai-gateway.key` (mode 0600) bila tidak diisi |

## Skrip

```bash
pnpm dev          # API + web (paralel, mode pengembangan)
pnpm build        # build produksi API + web
pnpm test         # unit + integration (Vitest)
pnpm test:e2e     # end-to-end (Playwright; butuh port 5173 & 3001 bebas)
pnpm typecheck    # TypeScript tanpa emit
pnpm lint         # ESLint
pnpm db:migrate   # migrasi database
```

## Struktur repo

```
apps/
  api/            # backend Fastify + Drizzle + SQLite (REST, SSE, gateway AI)
  web/            # frontend React + TypeScript + Vite + Tailwind
packages/
  shared/         # skema Zod & tipe DTO bersama API ↔ web
docs/             # PRD, spesifikasi teknis, spesifikasi UI/UX, checklist rilis
tickets/          # tiket implementasi (riwayat pembangunan)
design/           # mockup konseptual
```

Alur data ringkas: **React Query → REST `/api` → service → Drizzle → SQLite**. AI lewat gateway internal yang menegakkan kebijakan jaringan (HTTPS remote, pengecualian loopback eksplisit) dan tidak pernah mencatat API key.

## Keamanan & privasi

- Kredensial provider **hanya tersimpan di database SQLite lokal Anda** (terenkripsi) — tidak pernah masuk repo, log, export ZIP, atau localStorage browser.
- Folder `data/` dan file `.env` di-ignore git secara default.
- Badge AI selalu jujur: hijau **Lokal** (Ollama/loopback) atau amber **Remote** — tidak pernah mengklaim koneksi yang tidak ada.
- Sebelum push/berbagi, pastikan `git status` tidak memuat file di luar daftar di atas.

## Berkontribusi

1. Fork repo ini.
2. Buat branch: `git checkout -b fitur/nama-fitur`.
3. Ikuti pola kode yang ada (modul kecil, validasi input di server, tipe di semua batas API).
4. Jalankan `pnpm typecheck && pnpm lint && pnpm test` sebelum membuka pull request.
5. Tulis deskripsi PR yang jelas: masalah, perubahan, dan cara memverifikasi.

## Lisensi

Proyek ini berlisensi [MIT](LICENSE).
