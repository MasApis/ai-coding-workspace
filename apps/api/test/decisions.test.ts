import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "decisions-test-")), "test.sqlite");
}

describe("decisions API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let projectId: string;

  beforeEach(async () => {
    app = await createApp(tempDbPath(), { gatewayKey: randomBytes(32) });
    projectId = (await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Dec" } })).json().data.id as string;
  });

  afterEach(async () => {
    await app.close();
  });

  it("saves and lists answers per project", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/decisions`,
      payload: { question: "Untuk siapa?", answer: "Siswa" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({ question: "Untuk siapa?", answer: "Siswa" });

    const listed = await app.inject({ method: "GET", url: `/api/projects/${projectId}/decisions` });
    expect(listed.json().data.items).toHaveLength(1);

    const other = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Lain" } });
    const otherId = other.json().data.id as string;
    const otherList = await app.inject({ method: "GET", url: `/api/projects/${otherId}/decisions` });
    expect(otherList.json().data.items).toHaveLength(0);
  });

  it("rejects empty answers and unknown projects", async () => {
    const bad = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/decisions`,
      payload: { question: "Q?", answer: "" },
    });
    expect(bad.statusCode).toBe(422);

    const missing = await app.inject({
      method: "POST",
      url: `/api/projects/${randomUUID()}/decisions`,
      payload: { question: "Q?", answer: "A" },
    });
    expect(missing.statusCode).toBe(404);
  });
});
