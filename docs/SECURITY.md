# SECURITY — AI Coding Workspace

Status: hidup berdampingan dengan kode. Setiap klaim di bawah ditautkan ke test otomatis; yang tidak bisa di-test ditulis sebagai risiko terbuka, bukan janji.

## Model ancaman
- Satu pengguna lokal di `127.0.0.1`. Batasan trust: akun OS pengguna. **Di luar model**: malware/root di level yang sama, serangan fisik, dan backup yang bocor keluar mesin (backup JSON tidak dienkripsi — lihat TICKET-021).
- Kredensial provider tidak pernah: masuk git, masuk ekspor ZIP/proyek, kembali ke frontend, atau ditulis ke log (hanya id provider + kode + latensi yang di-log).

## Batas yang ditegakkan kode + testnya
| Kontrol | Implementasi | Test |
|---|---|---|
| CORS allowlist tunggal | `app.ts` (`@fastify/cors`, origin `127.0.0.1:5173`) | `security.test.ts` (origin asing = tanpa header ACAO) |
| Header keamanan API | `@fastify/helmet` tanpa CSP global | `security.test.ts` (nosniff, frame-options, referrer-policy) |
| Envelope error tanpa stack/secret | `setErrorHandler` + `sendError` per rute | `security.test.ts` (tanpa `at `, tanpa `node_modules`) |
| Batas body impor 10 MB | `bodyLimit` rute + 413 `PAYLOAD_TOO_LARGE` | `security.test.ts` |
| URL custom tervalidasi | skema Zod (https/loopback, tanpa kredensial di URL) | `shared/test/provider.test.ts` |
| SSRF runtime | `assertRoutableTarget` (blokir privat/link-local/loopback kecuali eksplisit) | `ai-gateway.test.ts` (IP privat ditolak) |
| Redirect tidak aman ditolak | `fetchWithPolicy` (same-origin, maks 2) | kontrak adapter |
| Markdown aman | `marked` + DOMPurify | `web/test/markdown.test.ts` |
| Prototipe tanpa skrip + sandbox | escape HTML + iframe `sandbox=""` + header CSP `sandbox` + unduh attachment | `design-prototype*.test.ts` + `security.test.ts` |
| ZIP ekspor tanpa secret | hanya konten dokumen + manifest hash | `exports.test.ts` (grep secret, hash cocok) |
| Traversal path | allowlist direktori + normalisasi | `exports.test.ts`, `templates.test.ts` |
| Isolasi proyek | cek `projectId` di semua query nested | `documents/conversations/chat-context.test.ts` |
| Kunci secret 0600, di luar DB | `secrets.ts` (AES-256-GCM, `AI_GATEWAY_KEY` atau file) | `providers.test.ts` (redaksi di semua respons) |

## Kebijakan LAN (AI-029)
- Custom endpoint remote wajib HTTPS + host global-unicast. Loopback (`127.0.0.1`, `::1`, `localhost`) bebas — untuk Ollama lokal.
- IP privat/link-local literal maupun hasil DNS non-routabel → `REMOTE_BLOCKED`, kecuali `ALLOW_LAN_PROVIDERS=true` (opt-in eksplisit, tercatat sekali via peringatan log saat dipakai).
- TOCTOU DNS-rebinding tetap risiko terbuka (lihat di bawah).

## Risiko terbuka (jujur, bukan TODO diam-diam)
1. **TOCTOU DNS-rebinding**: cek DNS saat request vs connect bisa berpacu. Milik AI-029 (custom agent + pinning).
2. **Backup JSON plaintext**: siapa pun membaca file backup melihat seluruh isi proyek. Mitigasi: simpan di media terenkripsi; dienkripsi resmi menunggu keputusan desain (AI-029).
3. **Kunci gateway hilang = kredensial tak terbaca** (gagal tegas, bukan diam-diam).
4. **Audit visual/manual** (lebar layar, keyboard penuh, screen reader) belum otomatis — milik TICKET-023.
5. **Rate limiting** belum ada (`@fastify/rate-limit` opsional per Tech Spec) — single-user lokal, risiko rendah; pertimbangkan bila API dibuka lebih luas.
