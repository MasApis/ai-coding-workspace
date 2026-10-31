import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db/connection.js";
import * as schema from "../src/db/schema.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "projects-test-")), "test.sqlite");
}

describe("projects API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let dbPath: string;

  beforeEach(async () => {
    dbPath = tempDbPath();
    app = await createApp(dbPath);
  });

  afterEach(async () => {
    await app.close();
  });

  it("serves health", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { status: "ok" } });
  });

  it("roundtrips create -> get -> patch -> list -> archive -> delete", async () => {
    const created = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Todo App" } });
    expect(created.statusCode).toBe(201);
    const project = created.json().data as { id: string; slug: string; state: string };
    expect(project.slug).toBe("todo-app");

    const got = await app.inject({ method: "GET", url: `/api/projects/${project.id}` });
    expect(got.statusCode).toBe(200);

    const archived = await app.inject({
      method: "PATCH",
      url: `/api/projects/${project.id}`,
      payload: { state: "archived" },
    });
    expect(archived.statusCode).toBe(200);
    expect(archived.json().data.state).toBe("archived");

    const activeList = await app.inject({ method: "GET", url: "/api/projects" });
    expect(activeList.json().data.items).toHaveLength(0);

    const archivedList = await app.inject({ method: "GET", url: "/api/projects?state=archived" });
    expect(archivedList.json().data.items).toHaveLength(1);

    const deleted = await app.inject({ method: "DELETE", url: `/api/projects/${project.id}` });
    expect(deleted.statusCode).toBe(204);

    const gone = await app.inject({ method: "GET", url: `/api/projects/${project.id}` });
    expect(gone.statusCode).toBe(404);
    expect(gone.json().error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("rejects invalid input with structured errors", async () => {
    const empty = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "" } });
    expect(empty.statusCode).toBe(422);
    expect(empty.json().error.code).toBe("VALIDATION_ERROR");

    const badSlug = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "A", slug: "Bad!" } });
    expect(badSlug.statusCode).toBe(422);

    const created = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Dup" } });
    const id = (created.json().data as { id: string }).id;
    const badPatch = await app.inject({ method: "PATCH", url: `/api/projects/${id}`, payload: { state: "deleted" } });
    expect(badPatch.statusCode).toBe(422);
  });

  it("rejects slug conflicts", async () => {
    await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Same" } });
    const dup = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Same" } });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe("PROJECT_SLUG_TAKEN");
  });

  it("refuses to delete projects that still have content", async () => {
    const created = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Full" } });
    const id = (created.json().data as { id: string }).id;

    // Seed a document directly: document endpoints belong to TICKET-009.
    const seed = openDatabase(dbPath);
    seed.db
      .insert(schema.documents)
      .values({ id: randomUUID(), projectId: id, type: "PRD", title: "PRD" })
      .run();
    seed.close();

    const del = await app.inject({ method: "DELETE", url: `/api/projects/${id}` });
    expect(del.statusCode).toBe(409);
    expect(del.json().error.code).toBe("PROJECT_HAS_CONTENT");
  });

  it("returns 404 for unknown ids", async () => {
    const got = await app.inject({ method: "GET", url: "/api/projects/does-not-exist" });
    expect(got.statusCode).toBe(404);
    const del = await app.inject({ method: "DELETE", url: "/api/projects/does-not-exist" });
    expect(del.statusCode).toBe(404);
  });
});
