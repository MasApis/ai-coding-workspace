import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "backup-test-")), "test.sqlite");
}

const SECRET = "sk-backup-probe-xyz";

describe("backup and restore", () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeEach(async () => {
    app = await createApp(tempDbPath(), { gatewayKey: randomBytes(32) });
  });

  afterEach(async () => {
    await app.close();
  });

  async function seedProject(name: string): Promise<string> {
    const project = await app.inject({ method: "POST", url: "/api/projects", payload: { name } });
    const projectId = project.json().data.id as string;
    const doc = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/documents`,
      payload: { type: "PRD", title: "PRD", contentMd: "# v1" },
    });
    const docId = doc.json().data.id as string;
    await app.inject({ method: "POST", url: `/api/documents/${docId}/versions`, payload: { contentMd: "# v2" } });
    const conv = await app.inject({ method: "POST", url: `/api/projects/${projectId}/conversations`, payload: { title: "T" } });
    const convId = conv.json().data.id as string;
    await app.inject({ method: "POST", url: `/api/conversations/${convId}/messages`, payload: { role: "user", contentMd: "hi" } });
    return projectId;
  }

  it("roundtrips a project with identical content", async () => {
    const projectId = await seedProject("Asli");
    const exported = await app.inject({ method: "GET", url: `/api/projects/${projectId}/backup` });
    expect(exported.statusCode).toBe(200);
    expect(String(exported.headers["content-disposition"])).toContain("attachment");
    const backup = exported.json();

    const imported = await app.inject({ method: "POST", url: "/api/projects/import", payload: { backup } });
    expect(imported.statusCode).toBe(201);
    const newId = imported.json().data.projectId as string;
    expect(newId).not.toBe(projectId);

    for (const id of [projectId, newId]) {
      const docs = await app.inject({ method: "GET", url: `/api/projects/${id}/documents` });
      expect(docs.json().data.items).toHaveLength(1);
      expect(docs.json().data.items[0].contentMd).toBe("# v2");
      const convs = await app.inject({ method: "GET", url: `/api/projects/${id}/conversations` });
      const messages = await app.inject({ method: "GET", url: `/api/conversations/${convs.json().data.items[0].id}/messages` });
      expect(messages.json().data.items.map((m: { role: string }) => m.role)).toEqual(["user"]);
    }

    const slugs = await app.inject({ method: "GET", url: "/api/projects?state=all" });
    expect(new Set(slugs.json().data.items.map((p: { slug: string }) => p.slug)).size).toBe(2);
  });

  it("never includes provider secrets", async () => {
    await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "R", protocol: "openai-compatible", baseUrl: "https://api.example.com/v1", credential: SECRET },
    });
    const projectId = await seedProject("Rahasia");
    const exported = await app.inject({ method: "GET", url: `/api/projects/${projectId}/backup` });
    expect(exported.body).not.toContain(SECRET);
  });

  it("rejects invalid archives", async () => {
    const garbage = await app.inject({ method: "POST", url: "/api/projects/import", payload: { backup: { nope: true } } });
    expect(garbage.statusCode).toBe(422);
    expect(garbage.json().error.code).toBe("INVALID_BACKUP");

    const wrongVersion = await app.inject({
      method: "POST",
      url: "/api/projects/import",
      payload: { backup: { schemaVersion: 99, exportedAt: "x", project: {}, documents: [], decisions: [], tasks: [], conversations: [], preferences: [], designVersions: [] } },
    });
    expect(wrongVersion.statusCode).toBe(422);

    const missing = await app.inject({ method: "GET", url: "/api/projects/does-not-exist/backup" });
    expect(missing.statusCode).toBe(404);
  });
});
