import type { StarterTemplate } from "./types.js";
import { MIT_NOTICE } from "./license.js";

export const HTML_STARTER: StarterTemplate = {
  id: "static-html",
  name: "Situs Statis HTML/CSS/JS",
  stack: "HTML",
  license: "MIT",
  description: "Halaman statis tanpa build step: buka index.html langsung di browser. Cocok untuk prototipe dan landing page.",
  variables: [
    { name: "APP_NAME", description: "Nama aplikasi untuk judul halaman", defaultValue: "Aplikasi Saya" },
    { name: "ACCENT", description: "Warna aksen (hex)", defaultValue: "#4F46E5" },
  ],
  files: [
    {
      path: "README.md",
      content: [
        "# {{APP_NAME}}",
        "",
        "Starter situs statis dari AI Coding Workspace (lisensi MIT).",
        "",
        "## Cara pakai",
        "1. Ganti `{{APP_NAME}}` dengan nama aplikasi Anda.",
        "2. Ganti `{{ACCENT}}` dengan warna aksen (hex), mis. `#4F46E5`.",
        "3. Buka `index.html` di browser. Tanpa build step.",
        "",
        "## Struktur",
        "- `index.html` — struktur halaman",
        "- `styles.css` — gaya (variabel aksen di `:root`)",
        "- `app.js` — interaktivitas kecil",
      ].join("\n"),
    },
    {
      path: "index.html",
      content: [
        "<!doctype html>",
        '<html lang="id">',
        "<head>",
        '  <meta charset="utf-8">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1">',
        "  <title>{{APP_NAME}}</title>",
        '  <link rel="stylesheet" href="styles.css">',
        "</head>",
        "<body>",
        "  <main>",
        "    <h1>{{APP_NAME}}</h1>",
        '    <p id="pesan">Tekan tombol untuk memulai.</p>',
        '    <button id="tombol" type="button">Klik saya</button>',
        "  </main>",
        '  <script src="app.js"></script>',
        "</body>",
        "</html>",
      ].join("\n"),
    },
    {
      path: "styles.css",
      content: [
        ":root {",
        "  --accent: {{ACCENT}};",
        "}",
        "body { font-family: system-ui, sans-serif; margin: 0; background: #f8fafc; color: #0f172a; }",
        "main { max-width: 640px; margin: 48px auto; padding: 0 16px; }",
        "button { background: var(--accent); color: #fff; border: 0; border-radius: 8px; min-height: 44px; padding: 0 16px; font-size: 1rem; }",
      ].join("\n"),
    },
    {
      path: "app.js",
      content: [
        "document.getElementById('tombol').addEventListener('click', function () {",
        "  document.getElementById('pesan').textContent = 'Halo dari {{APP_NAME}}!';",
        "});",
      ].join("\n"),
    },
    { path: "LICENSE", content: MIT_NOTICE },
  ],
};
