import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, normalize, resolve, sep } from "node:path";
import JSZip from "jszip";
import { STARTER_TEMPLATES, type StarterTemplate } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { HttpError } from "../http/errors.js";
import { createProject } from "./projectService.js";
import { findWorkspaceRoot } from "../lib/paths.js";

const ZIP_ENTRY_DATE = new Date("2000-01-01T00:00:00Z");

export function listStarterMetadata(): Array<{
  id: string;
  name: string;
  stack: string;
  license: string;
  description: string;
  variables: StarterTemplate["variables"];
  fileCount: number;
  files: string[];
}> {
  return STARTER_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    stack: t.stack,
    license: t.license,
    description: t.description,
    variables: t.variables,
    fileCount: t.files.length,
    files: t.files.map((f) => f.path),
  }));
}

function requireTemplate(templateId: string): StarterTemplate {
  const template = STARTER_TEMPLATES.find((t) => t.id === templateId);
  if (!template) throw new HttpError("TEMPLATE_NOT_FOUND", `template not found: ${templateId}`);
  return template;
}

export function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new HttpError("VALIDATION_ERROR", "name must produce a non-empty slug");
  return slug;
}

function renderTemplate(template: StarterTemplate, variables: Record<string, string>): Map<string, string> {
  const known = new Map(template.variables.map((v) => [v.name, v.defaultValue]));
  for (const key of Object.keys(variables)) {
    if (!known.has(key)) {
      throw new HttpError("VALIDATION_ERROR", `unknown variable for template ${template.id}: ${key}`);
    }
  }
  const merged = new Map<string, string>();
  for (const [name, fallback] of known) {
    merged.set(name, variables[name] ?? fallback);
  }
  const files = new Map<string, string>();
  for (const file of template.files) {
    let content = file.content;
    for (const [name, value] of merged) {
      content = content.split(`{{${name}}}`).join(value);
    }
    files.set(file.path, content);
  }
  return files;
}

export function templatesDir(): string {
  const raw = process.env["EXPORT_DIR"] ?? "./data/exports";
  return resolve(findWorkspaceRoot(process.cwd()), raw, "templates");
}

// Derived from the template id and a slugified name only — never from raw
// user paths. Still re-validated on the way out (defense in depth).
function targetDirFor(slug: string): string {
  return resolve(templatesDir(), slug);
}

export function resolveTemplatePath(relativePath: string): string {
  const base = templatesDir();
  const normalized = normalize(relativePath);
  if (normalized.startsWith("..") || normalized.startsWith("/") || normalized.includes(`..${sep}`)) {
    throw new HttpError("INVALID_STATE", "template path escapes the templates directory");
  }
  const resolved = resolve(base, normalized);
  if (resolved !== base && !resolved.startsWith(base + sep)) {
    throw new HttpError("INVALID_STATE", "template path escapes the templates directory");
  }
  return resolved;
}

export interface Instantiation {
  projectId: string;
  relativePath: string;
}

export async function instantiateStarter(
  db: AppDatabase,
  templateId: string,
  input: { name: string; variables?: Record<string, string>; overwrite?: boolean },
): Promise<Instantiation> {
  const template = requireTemplate(templateId);
  if (!input.name || input.name.trim().length === 0 || input.name.length > 120) {
    throw new HttpError("VALIDATION_ERROR", "name must be 1-120 characters");
  }
  const slug = slugifyName(input.name);
  const dir = targetDirFor(slug);
  if (existsSync(dir) && !input.overwrite) {
    throw new HttpError("TEMPLATE_TARGET_EXISTS", `target already exists: templates/${slug}/ (pass overwrite to replace)`);
  }

  const project = await createProject(db, { name: input.name.trim() });
  const files = renderTemplate(template, input.variables ?? {});
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  for (const [relPath, content] of files) {
    const absolute = resolve(dir, normalize(relPath));
    if (absolute !== dir && !absolute.startsWith(dir + sep)) {
      throw new HttpError("INVALID_STATE", "template file escapes the target directory");
    }
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, content, "utf8");
  }
  return { projectId: project.id, relativePath: `templates/${slug}/` };
}

export async function buildStarterZip(templateId: string, variables?: Record<string, string>): Promise<Buffer> {
  const template = requireTemplate(templateId);
  const zip = new JSZip();
  for (const [relPath, content] of renderTemplate(template, variables ?? {})) {
    zip.file(relPath, content, { date: ZIP_ENTRY_DATE, compression: "STORE" });
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "STORE", platform: "UNIX" });
}

export function getTemplateOrThrow(templateId: string): StarterTemplate {
  return requireTemplate(templateId);
}
