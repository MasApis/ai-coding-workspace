import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { normalize, resolve, sep } from "node:path";
import JSZip from "jszip";
import type { DocumentDto, ExportDto, ExportManifest, ExportManifestDoc } from "@workspace/shared";
import { EXPORT_FILENAMES } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { exports } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { HttpError } from "../http/errors.js";
import { listDocuments } from "./documentService.js";
import { getProject } from "./projectService.js";
import { findWorkspaceRoot } from "../lib/paths.js";

// Fixed in-zip timestamps keep identical inputs byte-identical.
const ZIP_ENTRY_DATE = new Date("2000-01-01T00:00:00Z");

function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function exportDir(): string {
  const raw = process.env["EXPORT_DIR"] ?? "./data/exports";
  return resolve(findWorkspaceRoot(process.cwd()), raw);
}

// Filenames come from a fixed map, never from user input. The stored
// relative path is still validated on the way out (defense in depth).
export function resolveExportFilePath(relativeFilePath: string): string {
  const base = exportDir();
  const normalized = normalize(relativeFilePath);
  if (normalized.startsWith("..") || normalized.startsWith("/") || normalized.includes(`..${sep}`)) {
    throw new HttpError("INVALID_STATE", "export path escapes the export directory");
  }
  const resolved = resolve(base, normalized);
  if (resolved !== base && !resolved.startsWith(base + sep)) {
    throw new HttpError("INVALID_STATE", "export path escapes the export directory");
  }
  return resolved;
}

function buildReadme(projectName: string, files: string[]): string {
  return [
    `# Serah terima OpenCode — ${projectName}`,
    ``,
    `Paket ini berisi dokumen yang sudah disetujui (plus draf bila Anda memilihnya) beserta manifest berisi checksum SHA-256.`,
    ``,
    `## Isi paket`,
    ...files.map((f) => `- ${f}`),
    ``,
    `## Cara memakai`,
    `1. Unzip ke folder kerja: \`unzip <nama-file>.zip -d kerja-saya && cd kerja-saya\``,
    "2. Jalankan OpenCode di folder tersebut: `opencode`",
    '3. Minta implementasi tahap awal, misal: `opencode run "Implementasikan sesuai PRD.md dan TECHNICAL_SPEC.md"`',
    `4. Verifikasi setiap berkas dengan checksum di manifest.json: \`sha256sum -c <(jq -r '.docs[] | "\\(.sha256)  \\(.type | . + \\".md\\")"' manifest.json)\` — perintah di atas membutuhkan jq; atau cocokkan manual.`,
    ``,
    `PRD.md, TECHNICAL_SPEC.md, TASKS.md, TEST_PLAN.md, dan AGENTS.md adalah sumber utama; dokumen lain adalah konteks pendukung.`,
  ].join("\n");
}

export async function createExport(db: AppDatabase, projectId: string, includeDrafts: boolean): Promise<{ dto: ExportDto; absolutePath: string }> {
  const project = await getProject(db, projectId);
  const docs = await listDocuments(db, projectId);
  const included = docs.filter((d) => (includeDrafts ? true : d.approvalState === "approved"));

  const zip = new JSZip();
  const manifestDocs: ExportManifestDoc[] = [];
  const files: string[] = [];

  const sorted = [...included].sort((a, b) => (EXPORT_FILENAMES[a.type] ?? a.type).localeCompare(EXPORT_FILENAMES[b.type] ?? b.type));
  for (const doc of sorted) {
    const filename = EXPORT_FILENAMES[doc.type as keyof typeof EXPORT_FILENAMES] ?? `${doc.type}.md`;
    const content = doc.contentMd ?? "";
    zip.file(filename, content, { date: ZIP_ENTRY_DATE, compression: "STORE" });
    manifestDocs.push({
      type: doc.type,
      title: doc.title,
      versionNo: doc.currentVersionNo ?? 0,
      status: doc.approvalState as DocumentDto["approvalState"],
      sha256: sha256Hex(content),
    });
    files.push(filename);
  }

  const manifest: ExportManifest = {
    projectId: project.id,
    projectName: project.name,
    generatedAt: new Date().toISOString(),
    includeDrafts,
    docs: manifestDocs,
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  zip.file("manifest.json", manifestText, { date: ZIP_ENTRY_DATE, compression: "STORE" });
  const readme = buildReadme(project.name, [...files, "manifest.json", "README.md"]);
  zip.file("README.md", readme, { date: ZIP_ENTRY_DATE, compression: "STORE" });

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "STORE", platform: "UNIX" });
  const dir = exportDir();
  mkdirSync(dir, { recursive: true });
  const filename = `${project.slug}-handoff-${randomUUID().slice(0, 8)}.zip`;
  const absolutePath = resolve(dir, filename);
  if (!absolutePath.startsWith(dir + sep)) {
    throw new HttpError("INVALID_STATE", "export path escapes the export directory");
  }
  writeFileSync(absolutePath, buffer);

  const id = randomUUID();
  await db
    .insert(exports)
    .values({ id, projectId, manifestJson: JSON.stringify(manifest), relativeFilePath: filename })
    .run();
  const row = await db.select().from(exports).where(eq(exports.id, id)).get();
  if (!row) throw new HttpError("INTERNAL_ERROR", "export record was not saved");
  return {
    dto: {
      id: row.id,
      projectId: row.projectId,
      manifestJson: row.manifestJson,
      relativeFilePath: row.relativeFilePath,
      createdAt: row.createdAt.toISOString(),
    },
    absolutePath,
  };
}

export async function getExportFile(db: AppDatabase, id: string): Promise<{ dto: ExportDto; absolutePath: string; filename: string }> {
  const row = await db.select().from(exports).where(eq(exports.id, id)).get();
  if (!row) throw new HttpError("EXPORT_NOT_FOUND", `export not found: ${id}`);
  const absolutePath = resolveExportFilePath(row.relativeFilePath);
  return {
    dto: {
      id: row.id,
      projectId: row.projectId,
      manifestJson: row.manifestJson,
      relativeFilePath: row.relativeFilePath,
      createdAt: row.createdAt.toISOString(),
    },
    absolutePath,
    filename: row.relativeFilePath.split("/").pop() ?? "export.zip",
  };
}
