import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "security-test-")), "test.sqlite");
}

describe("security posture", () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeEach(async () => {
    app = await createApp(tempDbPath(), { gatewayKey: randomBytes(32) });
  });

  afterEach(async () => {
    await app.close();
  });

  it("emits security headers on API responses", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["referrer-policy"]).toBeDefined();
  });

  it("restricts CORS to the local web origin", async () => {
    const allowed = await app.inject({ method: "GET", url: "/api/health", headers: { origin: "http://127.0.0.1:5173" } });
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5173");

    const denied = await app.inject({ method: "GET", url: "/api/health", headers: { origin: "http://evil.example" } });
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("never leaks stack traces or internals in error envelopes", async () => {
    const res = await app.inject({ method: "POST", url: "/api/projects/import", payload: { backup: { schemaVersion: 1 } } });
    expect(res.statusCode).toBe(422);
    expect(res.body).not.toContain("at ");
    expect(res.body).not.toContain("node_modules");

    const missing = await app.inject({ method: "GET", url: "/api/documents/does-not-exist" });
    expect(missing.json().error).toEqual({ code: "DOCUMENT_NOT_FOUND", message: expect.any(String) });
  });

  it("rejects oversized import bodies", async () => {
    const big = "x".repeat(11 * 1024 * 1024);
    const res = await app.inject({ method: "POST", url: "/api/projects/import", payload: { backup: { schemaVersion: 1, blob: big } } });
    expect(res.statusCode).toBe(413);
    expect(res.json().error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("keeps prototype downloads sandboxed and attachment-only", async () => {
    const project = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Sec" } });
    const projectId = project.json().data.id as string;
    await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/documents`,
      payload: { type: "DESIGN_SPEC", title: "DS", contentMd: "# D\n\n## Layar\n\n- A\n" },
    });
    await app.inject({ method: "POST", url: `/api/projects/${projectId}/design/prototype` });
    const dl = await app.inject({ method: "GET", url: `/api/projects/${projectId}/design/prototype/download` });
    expect(String(dl.headers["content-security-policy"])).toContain("sandbox");
    expect(String(dl.headers["content-disposition"])).toContain("attachment");
    expect(dl.body).not.toContain("<script");
  });
});
