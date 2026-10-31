import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "conversations-test-")), "test.sqlite");
}

describe("conversations API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let projectA: string;
  let projectB: string;

  beforeEach(async () => {
    app = await createApp(tempDbPath(), { gatewayKey: randomBytes(32) });
    projectA = (await app.inject({ method: "POST", url: "/api/projects", payload: { name: "A" } })).json().data.id as string;
    projectB = (await app.inject({ method: "POST", url: "/api/projects", payload: { name: "B" } })).json().data.id as string;
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates and lists conversations per project", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/api/projects/${projectA}/conversations`,
      payload: { title: "Tanya PRD" },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({ projectId: projectA, title: "Tanya PRD" });

    const listA = await app.inject({ method: "GET", url: `/api/projects/${projectA}/conversations` });
    expect(listA.json().data.items).toHaveLength(1);

    const listB = await app.inject({ method: "GET", url: `/api/projects/${projectB}/conversations` });
    expect(listB.json().data.items).toHaveLength(0);

    const alias = await app.inject({ method: "GET", url: `/api/conversations?projectId=${projectA}` });
    expect(alias.json().data.items).toHaveLength(1);
  });

  it("stores and returns messages in order", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/conversations",
      payload: { projectId: projectA },
    });
    const id = created.json().data.id as string;

    await app.inject({ method: "POST", url: `/api/conversations/${id}/messages`, payload: { role: "user", contentMd: "Halo" } });
    await app.inject({
      method: "POST",
      url: `/api/conversations/${id}/messages`,
      payload: { role: "assistant", contentMd: "Hai", modelId: "m", contextManifest: { upstream: [{ documentId: randomUUID(), versionNo: 1 }] } },
    });

    const messages = await app.inject({ method: "GET", url: `/api/conversations/${id}/messages` });
    expect(messages.json().data.items.map((m: { role: string }) => m.role)).toEqual(["user", "assistant"]);
    expect(messages.json().data.items[1].modelId).toBe("m");
  });

  it("rejects cross-project access and bad payloads", async () => {
    const created = await app.inject({
      method: "POST",
      url: `/api/projects/${projectA}/conversations`,
      payload: {},
    });
    const id = created.json().data.id as string;

    const scoped = await app.inject({ method: "GET", url: `/api/projects/${projectB}/conversations/${id}` });
    expect(scoped.statusCode).toBe(404);

    const badRole = await app.inject({
      method: "POST",
      url: `/api/conversations/${id}/messages`,
      payload: { role: "robot", contentMd: "x" },
    });
    expect(badRole.statusCode).toBe(422);

    const badManifest = await app.inject({
      method: "POST",
      url: `/api/conversations/${id}/messages`,
      payload: { role: "user", contentMd: "x", contextManifest: { upstream: [{ documentId: "d" }] } },
    });
    expect(badManifest.statusCode).toBe(422);

    const missing = await app.inject({ method: "GET", url: `/api/conversations/${randomUUID()}/messages` });
    expect(missing.statusCode).toBe(404);
  });
});
