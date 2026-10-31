import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db/connection.js";
import * as schema from "../src/db/schema.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "routing-test-")), "test.sqlite");
}

function mockUpstream(tag: string): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      if (req.url === "/v1/models") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ data: [{ id: "m" }] }));
        return;
      }
      res.writeHead(200, { "Content-Type": "text/event-stream" }).end(
        `data: ${JSON.stringify({ choices: [{ delta: { content: `from-${tag}` } }] })}\n\ndata: [DONE]\n\n`,
      );
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.address() as { port: number }).port }));
  });
}

describe("provider routing", () => {
  let mockA: { server: Server; port: number };
  let mockB: { server: Server; port: number };
  let app: Awaited<ReturnType<typeof createApp>>;
  const dbPathRef: { path: string } = { path: "" };

  beforeAll(async () => {
    mockA = await mockUpstream("A");
    mockB = await mockUpstream("B");
  });

  afterAll(async () => {
    await new Promise<void>((r) => mockA.server.close(() => r()));
    await new Promise<void>((r) => mockB.server.close(() => r()));
  });

  beforeEach(async () => {
    dbPathRef.path = tempDbPath();
    app = await createApp(dbPathRef.path, { gatewayKey: randomBytes(32) });
  });

  afterEach(async () => {
    await app.close();
  });

  async function addProvider(label: string, port: number): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label, protocol: "openai-compatible", baseUrl: `http://127.0.0.1:${port}/v1` },
    });
    return res.json().data.id as string;
  }

  async function streamText(providerId: string): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/ai/chat/stream",
      payload: { providerId, modelId: "m", messages: [{ role: "user", content: "Hi" }] },
    });
    expect(res.statusCode).toBe(200);
    return res.body
      .split("\n\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line.replace(/^data: /, "")) as { type: string; text?: string })
      .filter((e) => e.type === "delta")
      .map((e) => e.text)
      .join("");
  }

  it("reports no effective selection when nothing is configured", async () => {
    const res = await app.inject({ method: "GET", url: "/api/ai/resolved" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NO_PROVIDER_CONFIGURED");
  });

  it("switching the default only changes the gateway route", async () => {
    const idA = await addProvider("ProvA", mockA.port);
    const idB = await addProvider("ProvB", mockB.port);

    await app.inject({ method: "PUT", url: "/api/ai/preferences", payload: { providerId: idA, modelId: "m" } });
    const resolvedA = await app.inject({ method: "GET", url: "/api/ai/resolved" });
    expect(resolvedA.json().data).toMatchObject({ providerId: idA, modelId: "m", scope: "global" });
    expect(await streamText(idA)).toBe("from-A");

    await app.inject({ method: "PUT", url: "/api/ai/preferences", payload: { providerId: idB, modelId: "m" } });
    const resolvedB = await app.inject({ method: "GET", url: "/api/ai/resolved" });
    expect(resolvedB.json().data).toMatchObject({ providerId: idB, modelId: "m", scope: "global" });
    expect(await streamText(idB)).toBe("from-B");
  });

  it("prefers project scope over global", async () => {
    const idA = await addProvider("ProvA", mockA.port);
    const idB = await addProvider("ProvB", mockB.port);
    await app.inject({ method: "PUT", url: "/api/ai/preferences", payload: { providerId: idA, modelId: "m" } });

    const project = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Routed" } });
    const projectId = project.json().data.id as string;
    await app.inject({ method: "PUT", url: `/api/projects/${projectId}/ai-preferences`, payload: { providerId: idB, modelId: "m" } });

    const resolved = await app.inject({ method: "GET", url: `/api/ai/resolved?projectId=${projectId}` });
    expect(resolved.json().data).toMatchObject({ providerId: idB, scope: "project" });
  });

  it("streaming never touches approved documents", async () => {
    const idA = await addProvider("ProvA", mockA.port);
    const project = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Frozen" } });
    const projectId = project.json().data.id as string;

    const seed = openDatabase(dbPathRef.path);
    const documentId = randomUUID();
    seed.db.insert(schema.documents).values({ id: documentId, projectId, type: "PRD", title: "PRD", approvalState: "approved" }).run();
    seed.db
      .insert(schema.documentVersions)
      .values({ id: randomUUID(), documentId, versionNo: 1, contentMd: "# frozen", origin: "user" })
      .run();
    seed.close();

    const before = openDatabase(dbPathRef.path);
    const beforeDocs = JSON.stringify(before.db.select().from(schema.documents).all());
    const beforeVersions = JSON.stringify(before.db.select().from(schema.documentVersions).all());
    before.close();

    for (let i = 0; i < 3; i++) {
      expect(await streamText(idA)).toBe("from-A");
    }

    const after = openDatabase(dbPathRef.path);
    expect(JSON.stringify(after.db.select().from(schema.documents).all())).toBe(beforeDocs);
    expect(JSON.stringify(after.db.select().from(schema.documentVersions).all())).toBe(beforeVersions);
    after.close();
  });
});
