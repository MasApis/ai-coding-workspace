import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "chat-stream-test-")), "test.sqlite");
}

const SECRET = "sk-chat-test";

function mockUpstream(seen: { model?: string; messages?: number }): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      if (req.url === "/v1/models") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ data: [{ id: "m-a" }, { id: "m-b" }] }));
        return;
      }
      if (body.includes("bad-key")) {
        res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { message: "bad", code: "invalid_api_key" } }));
        return;
      }
      try {
        const parsed = JSON.parse(body) as { model?: string; messages?: unknown[] };
        seen.model = parsed.model;
        seen.messages = Array.isArray(parsed.messages) ? parsed.messages.length : 0;
      } catch {
        // ignore
      }
      const stream = `data: ${JSON.stringify({ choices: [{ delta: { content: "Halo chat" } }] })}\n\ndata: [DONE]\n\n`;
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

describe("chat streaming", () => {
  let mock: { server: Server; port: number };
  let seen: { model?: string; messages?: number };
  let app: Awaited<ReturnType<typeof createApp>>;
  let projectId: string;
  let conversationId: string;

  beforeAll(async () => {
    seen = {};
    mock = await mockUpstream(seen);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  });

  beforeEach(async () => {
    seen.model = undefined;
    seen.messages = undefined;
    app = await createApp(tempDbPath(), { gatewayKey: randomBytes(32) });
    const provider = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "C", protocol: "openai-compatible", baseUrl: `http://127.0.0.1:${mock.port}/v1`, credential: SECRET },
    });
    const providerId = provider.json().data.id as string;
    await app.inject({ method: "PUT", url: "/api/ai/preferences", payload: { providerId, modelId: "m-a" } });
    projectId = (await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Chat" } })).json().data.id as string;
    await app.inject({ method: "PUT", url: `/api/projects/${projectId}/ai-preferences`, payload: { providerId, modelId: "m-b" } });
    conversationId = (
      await app.inject({ method: "POST", url: `/api/projects/${projectId}/conversations`, payload: { title: "Sesi 1" } })
    ).json().data.id as string;
  });

  afterEach(async () => {
    await app.close();
  });

  it("streams with project preference and persists both sides", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages/stream`,
      payload: { contentMd: "Halo" },
    });
    expect(res.statusCode).toBe(200);
    const events = sseEvents(res.body);
    expect(events[0]?.type).toBe("start");
    expect(events.map((e) => e.type)).toContain("complete");
    expect(events.filter((e) => e.type === "delta").map((e) => e.text).join("")).toBe("Halo chat");
    const complete = events.find((e) => e.type === "complete") as { messageId?: string } | undefined;
    expect(typeof complete?.messageId).toBe("string");

    // Project preference (m-b) wins over global (m-a), history sent upstream.
    expect(seen.model).toBe("m-b");
    expect(seen.messages).toBe(2);

    const messages = await app.inject({ method: "GET", url: `/api/conversations/${conversationId}/messages` });
    const roles = messages.json().data.items.map((m: { role: string }) => m.role);
    expect(roles).toEqual(["user", "assistant"]);
    const assistant = messages.json().data.items[1];
    expect(assistant.modelId).toBe("m-b");
    expect(assistant.contentMd).toBe("Halo chat");
    expect(res.body).not.toContain(SECRET);
  });

  it("honors a per-message model override", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages/stream`,
      payload: { contentMd: "Hai", modelId: "m-a" },
    });
    expect(res.statusCode).toBe(200);
    expect(seen.model).toBe("m-a");
  });

  it("sends history on follow-ups", async () => {
    await app.inject({ method: "POST", url: `/api/conversations/${conversationId}/messages`, payload: { role: "user", contentMd: "satu" } });
    await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages/stream`,
      payload: { contentMd: "dua" },
    });
    expect(seen.messages).toBe(3);
  });

  it("saves only the user message when upstream fails", async () => {
    const other = (
      await app.inject({ method: "POST", url: "/api/conversations", payload: { projectId } })
    ).json().data.id as string;
    const res = await app.inject({
      method: "POST",
      url: `/api/conversations/${other}/messages/stream`,
      payload: { contentMd: "bad-key trigger" },
    });
    const events = sseEvents(res.body);
    expect(events.some((e) => e.type === "error")).toBe(true);

    const messages = await app.inject({ method: "GET", url: `/api/conversations/${other}/messages` });
    expect(messages.json().data.items.map((m: { role: string }) => m.role)).toEqual(["user"]);
  });

  it("rejects unknown conversations", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/conversations/does-not-exist/messages/stream",
      payload: { contentMd: "x" },
    });
    expect(res.statusCode).toBe(404);
  });
});
