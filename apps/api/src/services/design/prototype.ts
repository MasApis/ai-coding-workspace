import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { normalize, resolve, sep } from "node:path";
import { desc, eq } from "drizzle-orm";
import type { AppDatabase } from "../../db/connection.js";
import { designVersions, documentVersions, documents } from "../../db/schema.js";
import { HttpError } from "../../http/errors.js";
import { getProject } from "../projectService.js";
import { findWorkspaceRoot } from "../../lib/paths.js";

export function escapeHtml(raw: string): string {
  return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function extractScreens(sections: Map<string, string>): string[] {
  const screens: string[] = [];
  for (const key of ["Layar", "Komponen"]) {
    const body = sections.get(key);
    if (!body) continue;
    for (const line of body.split("\n")) {
      const item = line.replace(/^\s*[-*]\s+/, "").trim();
      if (item) screens.push(item);
    }
  }
  return screens.slice(0, 20);
}

export function extractTokens(sections: Map<string, string>): Map<string, string> {
  const tokens = new Map<string, string>();
  const body = sections.get("Token Desain");
  if (!body) return tokens;
  for (const line of body.split("\n")) {
    const item = line.replace(/^\s*[-*]\s+/, "");
    const sep = item.indexOf(":");
    if (sep > 0) {
      tokens.set(item.slice(0, sep).trim(), item.slice(sep + 1).trim());
    }
  }
  return tokens;
}

function cssVarName(label: string): string {
  return `--${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "token"}`;
}

export interface PrototypeInput {
  projectName: string;
  screens: string[];
  tokens: Map<string, string>;
}

export function buildPrototypeHtml(input: PrototypeInput): string {
  const vars = [...input.tokens.entries()].map(([label, value]) => `  ${cssVarName(label)}: ${escapeHtml(value)};`).join("\n");
  const cards = input.screens.length > 0 ? input.screens : ["Beranda"];
  const sections = cards
    .map((screen, i) => `    <section class="card">\n      <h2>${i + 1}. ${escapeHtml(screen)}</h2>\n      <p>Konten dan aksi primer layar ini didefinisikan di spesifikasi desain.</p>\n    </section>`)
    .join("\n");
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.projectName)} — prototipe</title>
<style>
:root {
${vars}
  --bg: #f8fafc;
  --ink: #0f172a;
}
body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--ink); margin: 0; padding: 24px; }
main { max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
h1 { font-size: 24px; }
h2 { font-size: 18px; margin: 0 0 8px; }
</style>
</head>
<body>
<main>
<h1>${escapeHtml(input.projectName)}</h1>
${sections}
</main>
</body>
</html>
`;
}

export function splitSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  let heading: string | null = null;
  let body: string[] = [];
  const flush = () => {
    if (heading) sections.set(heading, body.join("\n").trim());
    heading = null;
    body = [];
  };
  for (const line of markdown.split("\n")) {
    const match = line.match(/^##\s+(.+)\s*$/);
    if (match) {
      flush();
      heading = (match[1] ?? "").trim();
    } else if (heading !== null) {
      body.push(line);
    }
  }
  flush();
  return sections;
}

export function prototypesDir(): string {
  return resolve(findWorkspaceRoot(process.cwd()), "data", "prototypes");
}

// The stored path is derived from the project id and an integer version
// only — never from user input — and re-validated on the way out.
export function prototypeRelativePath(projectId: string, versionNo: number): string {
  if (!/^[0-9a-f-]{10,80}$/.test(projectId) || !Number.isInteger(versionNo) || versionNo < 1) {
    throw new HttpError("INVALID_STATE", "invalid prototype reference");
  }
  return `${projectId}/v${versionNo}/index.html`;
}

export function resolvePrototypeFile(relativeFilePath: string): string {
  const base = prototypesDir();
  const normalized = normalize(relativeFilePath);
  if (normalized.startsWith("..") || normalized.startsWith("/") || normalized.includes(`..${sep}`)) {
    throw new HttpError("INVALID_STATE", "prototype path escapes the prototypes directory");
  }
  const resolved = resolve(base, normalized);
  if (resolved !== base && !resolved.startsWith(base + sep)) {
    throw new HttpError("INVALID_STATE", "prototype path escapes the prototypes directory");
  }
  return resolved;
}

export interface PrototypeVersion {
  versionNo: number;
  specVersionNo: number | null;
  createdAt: string;
}

export async function generatePrototype(db: AppDatabase, projectId: string): Promise<PrototypeVersion> {
  const project = await getProject(db, projectId);
  const spec = await db.select().from(documents).where(eq(documents.type, "DESIGN_SPEC")).get();
  const specDoc = spec && spec.projectId === project.id ? spec : null;
  if (!specDoc?.currentVersionId) {
    throw new HttpError("DOCUMENT_NOT_FOUND", "no design specification to prototype yet");
  }
  const current = await db.select().from(documentVersions).where(eq(documentVersions.id, specDoc.currentVersionId)).get();
  if (!current) throw new HttpError("DOCUMENT_NOT_FOUND", "design specification version is missing");

  const sections = splitSections(current.contentMd);
  const html = buildPrototypeHtml({
    projectName: project.name,
    screens: extractScreens(sections),
    tokens: extractTokens(sections),
  });

  const latest = await db
    .select({ versionNo: designVersions.versionNo })
    .from(designVersions)
    .where(eq(designVersions.projectId, project.id))
    .orderBy(desc(designVersions.versionNo))
    .get();
  const versionNo = (latest?.versionNo ?? 0) + 1;
  const relativePath = prototypeRelativePath(project.id, versionNo);
  const absolutePath = resolvePrototypeFile(relativePath);
  mkdirSync(absolutePath.slice(0, absolutePath.lastIndexOf(sep)), { recursive: true });
  writeFileSync(absolutePath, html, "utf8");

  await db
    .insert(designVersions)
    .values({ id: randomUUID(), projectId: project.id, versionNo, specMd: current.contentMd, prototypePath: relativePath })
    .run();
  const row = await db
    .select()
    .from(designVersions)
    .where(eq(designVersions.prototypePath, relativePath))
    .get();
  return { versionNo, specVersionNo: current.versionNo, createdAt: (row?.createdAt ?? new Date()).toISOString() };
}

export async function getLatestPrototype(db: AppDatabase, projectId: string): Promise<PrototypeVersion & { relativePath: string }> {
  await getProject(db, projectId);
  const row = await db
    .select()
    .from(designVersions)
    .where(eq(designVersions.projectId, projectId))
    .orderBy(desc(designVersions.versionNo))
    .get();
  if (!row || !row.prototypePath) throw new HttpError("DOCUMENT_NOT_FOUND", "no prototype generated yet");
  return { versionNo: row.versionNo, specVersionNo: null, createdAt: row.createdAt.toISOString(), relativePath: row.prototypePath };
}

export function readPrototypeFile(relativeFilePath: string): Buffer {
  const absolutePath = resolvePrototypeFile(relativeFilePath);
  if (!existsSync(absolutePath)) throw new HttpError("EXPORT_NOT_FOUND", "prototype file is missing");
  return readFileSync(absolutePath);
}
