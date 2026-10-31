import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { CreateProjectInput, ProjectDto, ProjectWithSummaryDto, UpdateProjectInput } from "@workspace/shared";
import { conversations, decisions, documents, exports, projects, tasks } from "../db/schema.js";
import type { AppDatabase } from "../db/connection.js";
import { HttpError } from "../http/errors.js";
import { loadProjectSummaries } from "./projectSummary.js";

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new HttpError("VALIDATION_ERROR", "name must produce a non-empty slug");
  return slug;
}

function toDto(row: typeof projects.$inferSelect): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    ideaMd: row.ideaMd,
    state: row.state === "archived" ? "archived" : "active",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listProjects(db: AppDatabase, state: "active" | "archived" | "all"): Promise<ProjectDto[]> {
  const rows = await db.select().from(projects).orderBy(projects.updatedAt).all();
  const filtered = state === "all" ? rows : rows.filter((r) => (r.state === "archived" ? "archived" : "active") === state);
  return filtered.reverse().map(toDto);
}

// List view needs stage/next action per row; summaries are loaded in one batch
// to avoid a query per project.
export async function listProjectsWithSummary(db: AppDatabase, state: "active" | "archived" | "all"): Promise<ProjectWithSummaryDto[]> {
  const items = await listProjects(db, state);
  const summaries = await loadProjectSummaries(db, items.map((item) => item.id));
  return items.map((item) => ({
    ...item,
    summary: summaries.get(item.id) ?? {
      stage: "PROJECT_BRIEF",
      nextAction: { kind: "create-document", documentType: "PROJECT_BRIEF" },
      documents: { total: 0, approved: 0, stale: 0 },
      tasks: { total: 0, done: 0 },
      lastExportAt: null,
    },
  }));
}

export async function createProject(db: AppDatabase, input: CreateProjectInput): Promise<ProjectDto> {
  const slug = input.slug ?? slugify(input.name);
  const existing = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug)).get();
  if (existing) throw new HttpError("PROJECT_SLUG_TAKEN", `slug already taken: ${slug}`);

  const id = randomUUID();
  await db
    .insert(projects)
    .values({
      id,
      name: input.name,
      slug,
      description: input.description ?? null,
      ideaMd: input.ideaMd ?? null,
    })
    .run();
  return getProject(db, id);
}

export async function getProject(db: AppDatabase, id: string): Promise<ProjectDto> {
  const row = await db.select().from(projects).where(eq(projects.id, id)).get();
  if (!row) throw new HttpError("PROJECT_NOT_FOUND", `project not found: ${id}`);
  return toDto(row);
}

export async function getProjectWithSummary(db: AppDatabase, id: string): Promise<ProjectWithSummaryDto> {
  const project = await getProject(db, id);
  const summaries = await loadProjectSummaries(db, [project.id]);
  const summary = summaries.get(project.id);
  if (!summary) throw new HttpError("PROJECT_NOT_FOUND", `project summary unavailable: ${id}`);
  return { ...project, summary };
}

export async function updateProject(db: AppDatabase, id: string, input: UpdateProjectInput): Promise<ProjectDto> {
  await getProject(db, id);
  const patch: Partial<{ name: string; description: string | null; ideaMd: string | null; state: string }> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.ideaMd !== undefined) patch.ideaMd = input.ideaMd;
  if (input.state !== undefined) patch.state = input.state;
  await db.update(projects).set(patch).where(eq(projects.id, id)).run();
  return getProject(db, id);
}

async function countChildren(db: AppDatabase, projectId: string): Promise<number> {
  const tables = [documents, decisions, tasks, conversations, exports] as const;
  let total = 0;
  for (const table of tables) {
    const rows = await db.select({ id: table.id }).from(table).where(eq(table.projectId, projectId)).all();
    total += rows.length;
    if (total > 0) return total;
  }
  return total;
}

export async function deleteProject(db: AppDatabase, id: string): Promise<void> {
  await getProject(db, id);
  if ((await countChildren(db, id)) > 0) {
    throw new HttpError("PROJECT_HAS_CONTENT", "project still has documents, tasks, or other content");
  }
  await db.delete(projects).where(eq(projects.id, id)).run();
}
