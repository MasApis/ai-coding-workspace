import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "templates-test-")), "test.sqlite");
}

describe("templates API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let exportDir: string;

  beforeEach(async () => {
    exportDir = mkdtempSync(join(tmpdir(), "templates-out-"));
    process.env["EXPORT_DIR"] = exportDir;
    app = await createApp(tempDbPath(), { gatewayKey: randomBytes(32) });
  });

  afterEach(async () => {
    await app.close();
    delete process.env["EXPORT_DIR"];
  });

  it("lists catalog metadata without file contents", async () => {
    const res = await app.inject({ method: "GET", url: "/api/templates" });
    expect(res.statusCode).toBe(200);
    const items = res.json().data.items as Array<{ id: string; files: unknown }>;
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]).not.toHaveProperty("files", expect.anything);
    expect(items[0]).toHaveProperty("fileCount");
  });

  it("instantiates a starter with substitution and creates a project", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/templates/static-html/instantiate",
      payload: { name: "Coba", variables: { APP_NAME: "Coba" } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json().data as { projectId: string; relativePath: string };
    expect(body.projectId).toBeTruthy();

    const projects = await app.inject({ method: "GET", url: "/api/projects?state=all" });
    expect(projects.json().data.items).toHaveLength(1);

    expect(body.relativePath).toBe("templates/coba/");
    const { readFileSync, existsSync } = await import("node:fs");
    const indexPath = join(exportDir, body.relativePath, "index.html");
    expect(existsSync(indexPath)).toBe(true);
    expect(readFileSync(indexPath, "utf8")).toContain("<title>Coba</title>");
    expect(readFileSync(join(exportDir, body.relativePath, "README.md"), "utf8")).toContain("Coba");
  });

  it("refuses to overwrite by default and sanitizes names", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/api/templates/static-html/instantiate",
      payload: { name: "Sama" },
    });
    expect(first.statusCode).toBe(201);
    expect((first.json().data as { relativePath: string }).relativePath).toBe("templates/sama/");

    const dup = await app.inject({
      method: "POST",
      url: "/api/templates/static-html/instantiate",
      payload: { name: "Sama" },
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe("TEMPLATE_TARGET_EXISTS");

    const { mkdirSync } = await import("node:fs");
    mkdirSync(join(exportDir, "templates", "timpa"), { recursive: true });
    const overwrite = await app.inject({
      method: "POST",
      url: "/api/templates/static-html/instantiate",
      payload: { name: "Timpa", overwrite: true },
    });
    expect(overwrite.statusCode).toBe(201);

    const evil = await app.inject({
      method: "POST",
      url: "/api/templates/static-html/instantiate",
      payload: { name: "../../evil" },
    });
    expect(evil.statusCode).toBe(201);
    expect((evil.json().data as { relativePath: string }).relativePath).toBe("templates/evil/");
  });

  it("rejects unknown templates and variables", async () => {
    const missing = await app.inject({
      method: "POST",
      url: "/api/templates/nope/instantiate",
      payload: { name: "X" },
    });
    expect(missing.statusCode).toBe(404);

    const badVar = await app.inject({
      method: "POST",
      url: "/api/templates/static-html/instantiate",
      payload: { name: "Y", variables: { NOPE: "x" } },
    });
    expect(badVar.statusCode).toBe(422);
  });

  it("downloads a deterministic starter zip", async () => {
    const res = await app.inject({ method: "GET", url: "/api/templates/static-html/download" });
    expect(res.statusCode).toBe(200);
    expect(String(res.headers["content-type"])).toContain("application/zip");
  });
});
