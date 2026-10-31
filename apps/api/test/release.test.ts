import { existsSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/db/connection.js";
import { createApp } from "../src/app.js";
import { randomBytes } from "node:crypto";

describe("release: migrations and reinstall", () => {
  it("migrates a fresh database from 0000 to latest with all tables", () => {
    const dir = mkdtempSync(join(tmpdir(), "release-test-"));
    const dbPath = join(dir, "workspace.sqlite");
    expect(existsSync(dbPath)).toBe(false);
    const { sqlite, close } = openDatabase(dbPath);
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name")
      .all() as Array<{ name: string }>;
    expect(tables.map((t) => t.name)).toContain("projects");
    expect(tables.map((t) => t.name)).toContain("design_versions");
    expect(tables.map((t) => t.name)).toContain("provider_configs");
    expect(sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
    close();
  });

  it("reinstalls cleanly: delete db file, migrate, CRUD works", async () => {
    const dir = mkdtempSync(join(tmpdir(), "reinstall-test-"));
    const dbPath = join(dir, "workspace.sqlite");
    const first = await createApp(dbPath, { gatewayKey: randomBytes(32) });
    const created = await first.inject({ method: "POST", url: "/api/projects", payload: { name: "Lama" } });
    expect(created.statusCode).toBe(201);
    await first.close();

    rmSync(dbPath, { force: true });
    expect(existsSync(dbPath)).toBe(false);

    const second = await createApp(dbPath, { gatewayKey: randomBytes(32) });
    const health = await second.inject({ method: "GET", url: "/api/health" });
    expect(health.statusCode).toBe(200);
    const list = await second.inject({ method: "GET", url: "/api/projects" });
    expect(list.json().data.items).toHaveLength(0);
    const recreated = await second.inject({ method: "POST", url: "/api/projects", payload: { name: "Baru" } });
    expect(recreated.statusCode).toBe(201);
    await second.close();
  });
});
