import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "prototype-test-")), "test.sqlite");
}

describe("design prototype", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let projectId: string;

  beforeEach(async () => {
    app = await createApp(tempDbPath(), { gatewayKey: randomBytes(32) });
    projectId = (await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Proto" } })).json().data.id as string;
  });

  afterEach(async () => {
    await app.close();
  });

  async function addDesignSpec(content: string): Promise<void> {
    const doc = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/documents`,
      payload: { type: "DESIGN_SPEC", title: "Spesifikasi Desain", contentMd: content },
    });
    expect(doc.statusCode).toBe(201);
  }

  it("refuses without a design spec", async () => {
    const res = await app.inject({ method: "POST", url: `/api/projects/${projectId}/design/prototype` });
    expect(res.statusCode).toBe(404);
  });

  it("builds, versions, and downloads a script-free prototype", async () => {
    await addDesignSpec("# Spesifikasi Desain\n\n## Layar\n\n- Beranda<script>: daftar\n- Detail: isi\n\n## Token Desain\n\n- Primer: #111827\n");
    const first = await app.inject({ method: "POST", url: `/api/projects/${projectId}/design/prototype` });
    expect(first.statusCode).toBe(201);
    expect(first.json().data).toMatchObject({ versionNo: 1 });

    const second = await app.inject({ method: "POST", url: `/api/projects/${projectId}/design/prototype` });
    expect(second.json().data.versionNo).toBe(2);

    const latest = await app.inject({ method: "GET", url: `/api/projects/${projectId}/design/prototype` });
    expect(latest.json().data.versionNo).toBe(2);

    const dl = await app.inject({ method: "GET", url: `/api/projects/${projectId}/design/prototype/download` });
    expect(dl.statusCode).toBe(200);
    expect(String(dl.headers["content-type"])).toContain("text/html");
    expect(String(dl.headers["content-security-policy"])).toContain("sandbox");
    expect(String(dl.headers["content-disposition"])).toContain("attachment");
    expect(dl.body).not.toContain("<script>");
    expect(dl.body).toContain("Beranda&lt;script&gt;");
    expect(dl.body).toContain("--primer: #111827");
  });
});
