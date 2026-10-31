import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import * as schema from "../src/db/schema.js";

const closers: Array<() => void> = [];

afterEach(() => {
  while (closers.length > 0) {
    closers.pop()?.();
  }
});

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "workspace-test-")), "test.sqlite");
}

describe("database bootstrap", () => {
  it("applies migrations on a clean database with WAL and foreign keys on", () => {
    const { sqlite, close } = openDatabase(tempDbPath());
    closers.push(close);

    expect(sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);

    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name",
      )
      .all() as Array<{ name: string }>;
    expect(tables.map((t) => t.name).sort()).toEqual(
      [
        "ai_preferences",
        "ai_requests",
        "conversations",
        "decisions",
        "design_versions",
        "document_versions",
        "documents",
        "exports",
        "messages",
        "model_presets",
        "projects",
        "provider_configs",
        "provider_secrets",
        "tasks",
      ].sort(),
    );
  });

  it("roundtrips project -> document -> version", () => {
    const { db, close } = openDatabase(tempDbPath());
    closers.push(close);

    const projectId = randomUUID();
    db.insert(schema.projects).values({ id: projectId, name: "Todo", slug: "todo" }).run();
    const documentId = randomUUID();
    db
      .insert(schema.documents)
      .values({ id: documentId, projectId, type: "PRD", title: "PRD" })
      .run();
    db
      .insert(schema.documentVersions)
      .values({ id: randomUUID(), documentId, versionNo: 1, contentMd: "# v1", origin: "user" })
      .run();

    const rows = db.select().from(schema.documentVersions).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.contentMd).toBe("# v1");
  });

  it("rejects orphan document_versions (foreign keys enforced)", () => {
    const { db, close } = openDatabase(tempDbPath());
    closers.push(close);

    expect(() =>
      db
        .insert(schema.documentVersions)
        .values({ id: randomUUID(), documentId: randomUUID(), versionNo: 1, contentMd: "x", origin: "ai" })
        .run(),
    ).toThrow();
  });

  it("creates missing parent directories for the db file", () => {
    const nested = join(tempDbPath(), "nested", "deep", "test.sqlite");
    const { close } = openDatabase(nested);
    closers.push(close);
    expect(true).toBe(true);
  });

  it("running migrations twice stays successful (idempotent)", () => {
    const path = tempDbPath();
    const first = openDatabase(path);
    first.close();
    const second = openDatabase(path);
    closers.push(second.close);
    const count = second.sqlite
      .prepare("SELECT COUNT(*) AS n FROM __drizzle_migrations")
      .get() as { n: number };
    expect(count.n).toBeGreaterThan(0);
  });
});
