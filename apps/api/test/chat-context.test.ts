import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "chat-context-test-")), "test.sqlite");
}

interface Seen {
  systemText?: string;
}

function mockUpstream(seen: Seen): Promise<{ server: Server; port: number }> {
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
      try {
        const parsed = JSON.parse(body) as { messages?: Array<{ role?: string; content?: string }> };
        seen.systemText = (parsed.messages ?? []).filter((m) => m.role === "system").map((m) => m.content ?? "").join("\n");
      } catch {
        seen.systemText = "";
      }
      const stream = `data: ${JSON.stringify({ choices: [{ delta: { content: "ok" } }] })}\n\ndata: [DONE]\n\n`;
      res.writeHead(200, { "Content-Type": "text/event-stream" }).end(stream);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.address() as { port: number }).port }));
  });
}

describe("explicit document context", () => {
  let mock: { server: Server; port: number };
  let seen: Seen;
  let app: Awaited<ReturnType<typeof createApp>>;
  let projectId: string;
  let otherProjectId: string;
  let conversationId: string;
  let providerId: string;

  beforeAll(async () => {
    seen = {};
    mock = await mockUpstream(seen);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  });

  beforeEach(async () => {
    seen.systemText = undefined;
    app = await createApp(tempDbPath(), { gatewayKey: randomBytes(32) });
    const provider = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "C", protocol: "openai-compatible", baseUrl: `http://127.0.0.1:${mock.port}/v1` },
    });
    providerId = provider.json().data.id as string;
    await app.inject({ method: "PUT", url: "/api/ai/preferences", payload: { providerId, modelId: "m" } });
    projectId = (await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Ctx" } })).json().data.id as string;
    otherProjectId = (await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Other" } })).json().data.id as string;
    conversationId = (
      await app.inject({ method: "POST", url: `/api/projects/${projectId}/conversations`, payload: {} })
    ).json().data.id as string;
  });

  afterEach(async () => {
    await app.close();
  });

  async function addDoc(project: string, type: string, content: string, versionNo = 1): Promise<string> {
    const doc = await app.inject({
      method: "POST",
      url: `/api/projects/${project}/documents`,
      payload: { type, title: type, contentMd: content },
    });
    const id = doc.json().data.id as string;
    for (let v = 1; v < versionNo; v++) {
      await app.inject({ method: "POST", url: `/api/documents/${id}/versions`, payload: { contentMd: `${content} rev${v}` } });
    }
    return id;
  }

  it("sends nothing extra by default", async () => {
    await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages/stream`,
      payload: { contentMd: "Halo" },
    });
    expect(seen.systemText ?? "").not.toContain("Konteks dokumen");
  });

  it("attaches pinned versions and records the manifest", async () => {
    const docId = await addDoc(projectId, "PRD", "# v1 teks unik", 2);
    const res = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages/stream`,
      payload: { contentMd: "Jelaskan", contextDocs: [{ documentId: docId, versionNo: 1 }] },
    });
    expect(res.statusCode).toBe(200);
    expect(seen.systemText ?? "").toContain("# v1 teks unik");
    expect(seen.systemText ?? "").not.toContain("rev1");

    const messages = await app.inject({ method: "GET", url: `/api/conversations/${conversationId}/messages` });
    const assistant = messages.json().data.items.find((m: { role: string }) => m.role === "assistant");
    expect(assistant.contextManifest).toEqual({ upstream: [{ documentId: docId, versionNo: 1 }] });

    const user = messages.json().data.items.find((m: { role: string }) => m.role === "user");
    expect(user.contextManifest).toBeNull();
  });

  it("rejects cross-project documents without leaking", async () => {
    const foreignId = await addDoc(otherProjectId, "PRD", "# asing");
    const res = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages/stream`,
      payload: { contentMd: "x", contextDocs: [{ documentId: foreignId }] },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("rejects unknown documents and versions", async () => {
    const docId = await addDoc(projectId, "PRD", "# v1");
    const badDoc = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages/stream`,
      payload: { contentMd: "x", contextDocs: [{ documentId: "nope" }] },
    });
    expect(badDoc.statusCode).toBe(404);

    const badVersion = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages/stream`,
      payload: { contentMd: "x", contextDocs: [{ documentId: docId, versionNo: 99 }] },
    });
    expect(badVersion.statusCode).toBe(404);
  });
});
