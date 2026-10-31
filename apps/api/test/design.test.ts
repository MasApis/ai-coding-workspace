import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "design-test-")), "test.sqlite");
}

function mockUpstream(): Promise<{ server: Server; port: number }> {
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
      const stream = `data: ${JSON.stringify({ choices: [{ delta: { content: "Isi bagian desain dengan komponen dan token." } }] })}\n\ndata: [DONE]\n\n`;
      res.writeHead(200, { "Content-Type": "text/event-stream" }).end(stream);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.address() as { port: number }).port }));
  });
}

function sseEvents(body: string): Array<{ type: string; [k: string]: unknown }> {
  return body
    .split("\n\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line.replace(/^data: /, "")) as { type: string; [k: string]: unknown });
}

describe("design generation", () => {
  let mock: { server: Server; port: number };
  let app: Awaited<ReturnType<typeof createApp>>;
  let projectId: string;
  const dbPathRef: { path: string } = { path: "" };

  beforeAll(async () => {
    mock = await mockUpstream();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  });

  beforeEach(async () => {
    dbPathRef.path = tempDbPath();
    app = await createApp(dbPathRef.path, { gatewayKey: randomBytes(32) });
    const provider = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "D", protocol: "openai-compatible", baseUrl: `http://127.0.0.1:${mock.port}/v1` },
    });
    const providerId = provider.json().data.id as string;
    await app.inject({ method: "PUT", url: "/api/ai/preferences", payload: { providerId, modelId: "m" } });
    projectId = (await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Des" } })).json().data.id as string;
  });

  afterEach(async () => {
    await app.close();
  });

  async function approvePrd(content = "# PRD final"): Promise<string> {
    const doc = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/documents`,
      payload: { type: "PRD", title: "PRD", contentMd: content },
    });
    const id = doc.json().data.id as string;
    await app.inject({ method: "POST", url: `/api/documents/${id}/review` });
    await app.inject({ method: "POST", url: `/api/documents/${id}/approve` });
    return id;
  }

  it("refuses without an approved PRD baseline", async () => {
    const res = await app.inject({ method: "POST", url: `/api/projects/${projectId}/design/generate/stream`, payload: {} });
    const events = sseEvents(res.body);
    const error = events.find((e) => e.type === "error") as { code?: string } | undefined;
    expect(error?.code).toBe("NEED_APPROVED_BASELINE");

    const list = await app.inject({ method: "GET", url: `/api/projects/${projectId}/documents` });
    expect(list.json().data.items).toHaveLength(0);
  });

  it("generates a versioned design spec traced to the approved PRD", async () => {
    const prdId = await approvePrd();
    const res = await app.inject({ method: "POST", url: `/api/projects/${projectId}/design/generate/stream`, payload: {} });
    const events = sseEvents(res.body);
    expect(events[0]?.type).toBe("start");
    const progresses = events.filter((e) => e.type === "progress");
    expect(progresses.length).toBeGreaterThan(0);
    const complete = events.find((e) => e.type === "complete") as { documentId?: string; versionNo?: number } | undefined;
    expect(complete?.versionNo).toBe(1);

    const doc = await app.inject({ method: "GET", url: `/api/documents/${complete?.documentId}` });
    expect(doc.json().data).toMatchObject({ type: "DESIGN_SPEC", approvalState: "draft" });
    expect(doc.json().data.contentMd).toContain("## Peta Situs");
    expect(doc.json().data.contentMd).toContain("## Token Desain");

    const { openDatabase } = await import("../src/db/connection.js");
    const { documents } = await import("../src/db/schema.js");
    const { eq } = await import("drizzle-orm");
    const seed = openDatabase(dbPathRef.path);
    const row = await seed.db.select().from(documents).where(eq(documents.id, complete?.documentId as string)).get();
    seed.close();
    expect(row?.upstreamManifestJson).toContain(prdId);
  });

  it("does not touch approved specs without the flag", async () => {
    await approvePrd();
    const first = await app.inject({ method: "POST", url: `/api/projects/${projectId}/design/generate/stream`, payload: {} });
    const firstId = (sseEvents(first.body).find((e) => e.type === "complete") as { documentId?: string } | undefined)?.documentId as string;
    await app.inject({ method: "POST", url: `/api/documents/${firstId}/review` });
    await app.inject({ method: "POST", url: `/api/documents/${firstId}/approve` });

    const blocked = await app.inject({ method: "POST", url: `/api/projects/${projectId}/design/generate/stream`, payload: {} });
    expect((sseEvents(blocked.body).find((e) => e.type === "error") as { code?: string } | undefined)?.code).toBe("APPROVED_LOCKED");

    const ok = await app.inject({ method: "POST", url: `/api/projects/${projectId}/design/generate/stream`, payload: { fromApproved: true } });
    const complete = sseEvents(ok.body).find((e) => e.type === "complete") as { versionNo?: number } | undefined;
    expect(complete?.versionNo).toBe(2);
  });
});
