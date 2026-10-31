# Release Checklist — AI Coding Workspace (MVP + P1)

Tanggal verifikasi: 2026-10-31. Hasil otomatis di bawah benar-benar dijalankan; kotak manual hanya dicentang setelah manusia melakukannya.

## Otomatis — LULUS
- [x] `pnpm test` — 157 unit/integrasi PASS (vitest)
- [x] `pnpm test:e2e` — 10/10 PASS (Playwright/Chromium): wizard→daftar→detail, edit→review→approve, approved-lock, validasi settings, 5 lebar viewport tanpa overflow, chat empty-state
- [x] `pnpm typecheck`, `pnpm build`, `pnpm lint` — PASS
- [x] Migrasi 0000→0003 dari nol + reinstall (hapus DB → migrate → CRUD) — `release.test.ts`
- [x] Security suite — `security.test.ts` + `docs/SECURITY.md`
- [x] Kontrak AI per vendor (mock) — `ai-gateway.test.ts`, `ai-native.test.ts`, `ai-routing.test.ts`

## Manual — perlu manusia
- [ ] Jelajah keyboard penuh dengan screen reader (NVDA/VoiceOver) — pola ARIA sudah dipasang, belum diuji dengan AT asli
- [ ] Review screenshot `apps/web/e2e/screenshots/overview-{320,390,768,1024,1440}.png`
- [ ] Uji browser selain Chromium (Firefox/WebKit)
- [ ] Uji copywriting Indonesia menyeluruh (ejaan, konsistensi istilah)
- [ ] Smoke Ollama asli bila tersedia (`/api/providers/:id/test` + chat stream)
- [ ] Smoke kredensial cloud asli (satu prompt kecil, perhatikan tagihan)

## Catatan rilis
- Live AI smoke dengan kredensial asli terakhir: **belum dilakukan** (tidak ada kredensial; sesuai tiket "opsional").
- E2E memakai DB temporer per run; tidak menyentuh `data/` pengembang.
- Diketahui: POST tanpa body + header JSON kini dihindari di semua client (`FST_ERR_CTP_EMPTY_JSON_BODY` ditemukan E2E, diperbaiki).
