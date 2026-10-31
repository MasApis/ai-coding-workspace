import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "hardening-test-")), "test.sqlite");
}

interface Seen {
  hitsA: number;
  hitsB: number;
  modeA: "ok" | "fail";
}

function mockPair(seen: Seen): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      if (req.url === "/a/v1/models" || req.url === "/b/v1/models") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ data: [{ id: "m" }] }));
        return;
      }
      const which = req.url?.startsWith("/a/") ? "A" : "B";
      if (which === "A") {
        seen.hitsA += 1;
        if (seen.modeA === "fail") {
          res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { message: "boom" } }));
          return;
        }
      } else {
        seen.hitsB += 1;
      }
      void body;
      const stream = `data: ${JSON.stringify({ choices: [{ delta: { content: `bagian yang cukup panjang dari-${which}` } }] })}\n\ndata: [DONE]\n\n`;
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

describe("provider hardening", () => {
  let mock: { server: Server; port: number };
  let seen: Seen;
  let app: Awaited<ReturnType<typeof createApp>>;
  const dbPathRef: { path: string } = { path: "" };

  beforeAll(async () => {
    seen = { hitsA: 0, hitsB: 0, modeA: "ok" };
    mock = await mockPair(seen);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  });

  beforeEach(async () => {
    seen.hitsA = 0;
    seen.hitsB = 0;
    seen.modeA = "ok";
    dbPathRef.path = tempDbPath();
    app = await createApp(dbPathRef.path, { gatewayKey: randomBytes(32) });
  });

  afterEach(async () => {
    await app.close();
  });

  async function addProvider(label: string, path: string): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label, protocol: "openai-compatible", baseUrl: `http://127.0.0.1:${mock.port}${path}` },
    });
    return res.json().data.id as string;
  }

  it("never retries a failed paid request", async () => {
    const idA = await addProvider("Primer", "/a/v1");
    await app.inject({ method: "PUT", url: "/api/ai/preferences", payload: { providerId: idA, modelId: "m" } });
    const project = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "H" } });
    const projectId = project.json().data.id as string;
    seen.modeA = "fail";

    const res = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plan/generate/stream`,
      payload: { documentType: "PROJECT_BRIEF" },
    });
    const events = sseEvents(res.body);
    expect(events.some((e) => e.type === "error")).toBe(true);
    expect(seen.hitsA).toBe(1);
    expect(seen.hitsB).toBe(0);
  });

  it("uses the opt-in fallback only when configured", async () => {
    const idA = await addProvider("Primer", "/a/v1");
    const idB = await addProvider("Cadangan", "/b/v1");
    await app.inject({ method: "PUT", url: "/api/ai/preferences", payload: { providerId: idA, modelId: "m" } });
    const project = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "H" } });
    const projectId = project.json().data.id as string;

    const without = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plan/generate/stream`,
      payload: { documentType: "PROJECT_BRIEF" },
    });
    expect(sseEvents(without.body).some((e) => e.type === "complete")).toBe(true);

    // Primary goes away (deleted); without a fallback the request fails.
    await app.inject({ method: "DELETE", url: `/api/providers/${idA}` });
    const broken = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plan/generate/stream`,
      payload: { documentType: "PROJECT_BRIEF" },
    });
    expect(sseEvents(broken.body).some((e) => e.type === "error")).toBe(true);
    expect(seen.hitsB).toBe(0);

    // Opt in to the fallback: same request now routes to provider B.
    await app.inject({ method: "PUT", url: "/api/ai/fallback", payload: { providerId: idB, modelId: "m" } });
    const res = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plan/generate/stream`,
      payload: { documentType: "PROJECT_BRIEF" },
    });
    const events = sseEvents(res.body);
    expect(events.some((e) => e.type === "complete")).toBe(true);
    expect(seen.hitsB).toBeGreaterThan(0);
  });

  it("records usage without prompts or secrets", async () => {
    const idA = await addProvider("Primer", "/a/v1");
    await app.inject({ method: "PUT", url: "/api/ai/preferences", payload: { providerId: idA, modelId: "m" } });
    const project = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "U" } });
    const projectId = project.json().data.id as string;

    await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plan/generate/stream`,
      payload: { documentType: "PROJECT_BRIEF" },
    });
    const usage = await app.inject({ method: "GET", url: `/api/ai/usage?projectId=${projectId}` });
    expect(usage.statusCode).toBe(200);
    expect(usage.json().data.requests).toBeGreaterThanOrEqual(1);
    expect(usage.json().data.errors).toBe(0);
    expect(JSON.stringify(usage.json())).not.toContain("sk-");
  });

  it("rejects LAN endpoints by default and honors the opt-in", async () => {
    const { openDatabase } = await import("../src/db/connection.js");
    const { providerConfigs } = await import("../src/db/schema.js");
    const { randomUUID: uuid } = await import("node:crypto");
    const direct = openDatabase(dbPathRef.path);
    const lanId = uuid();
    direct.db.insert(providerConfigs).values({ id: lanId, label: "LAN", protocol: "openai-compatible", baseUrl: "http://192.168.1.20:11434/v1", enabled: true }).run();
    direct.close();
    await app.inject({ method: "PUT", url: "/api/ai/preferences", payload: { providerId: lanId, modelId: "m" } });
    const project = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "L" } });
    const projectId = project.json().data.id as string;

    const blocked = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plan/generate/stream`,
      payload: { documentType: "PROJECT_BRIEF" },
    });
    const codes = sseEvents(blocked.body).filter((e) => e.type === "error").map((e) => e.code);
    expect(codes).toContain("REMOTE_BLOCKED");

    const { assertRoutableTarget } = await import("../src/ai/httpShared.js");
    const previous = process.env["ALLOW_LAN_PROVIDERS"];
    try {
      process.env["ALLOW_LAN_PROVIDERS"] = "true";
      await expect(assertRoutableTarget("http://10.0.0.1:9/v1")).resolves.toBeUndefined();
    } finally {
      if (previous === undefined) delete process.env["ALLOW_LAN_PROVIDERS"];
      else process.env["ALLOW_LAN_PROVIDERS"] = previous;
    }
    await expect(assertRoutableTarget("http://10.0.0.1:9/v1")).rejects.toMatchObject({ code: "REMOTE_BLOCKED" });
  });
});
