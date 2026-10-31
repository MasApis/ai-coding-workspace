import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "planning-test-")), "test.sqlite");
}

type Mode = "ok" | "garbage" | "short" | "questions" | "bad-questions";

function mockUpstream(state: { mode: Mode }): Promise<{ server: Server; port: number }> {
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
      const stream =
        state.mode === "garbage"
          ? "bukan sse\n\n"
          : state.mode === "short"
            ? `data: ${JSON.stringify({ choices: [{ delta: { content: "x" } }] })}\n\ndata: [DONE]\n\n`
            : state.mode === "questions" || state.mode === "bad-questions"
              ? `data: ${JSON.stringify({ choices: [{ delta: { content: state.mode === "questions" ? '{"questions": ["Untuk siapa?", "Batasan apa?"]}' : "bukan json" } }] })}\n\ndata: [DONE]\n\n`
              : `data: ${JSON.stringify({ choices: [{ delta: { content: "Isi bagian dengan FR-1 dan kriteria penerimaan yang jelas." } }] })}\n\ndata: [DONE]\n\n`;
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

describe("planning API", () => {
  let mock: { server: Server; port: number };
  let state: { mode: Mode };
  let app: Awaited<ReturnType<typeof createApp>>;
  let projectId: string;
  let providerId: string;

  beforeAll(async () => {
    state = { mode: "ok" };
    mock = await mockUpstream(state);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  });

  beforeEach(async () => {
    state.mode = "ok";
    app = await createApp(tempDbPath(), { gatewayKey: randomBytes(32) });
    const provider = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "M", protocol: "openai-compatible", baseUrl: `http://127.0.0.1:${mock.port}/v1` },
    });
    providerId = provider.json().data.id as string;
    await app.inject({ method: "PUT", url: "/api/ai/preferences", payload: { providerId, modelId: "m" } });
    const project = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Plan" } });
    projectId = project.json().data.id as string;
  });

  afterEach(async () => {
    await app.close();
  });

  it("generates a sectioned PRD draft with progress events", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plan/generate/stream`,
      payload: { documentType: "PRD" },
    });
    expect(res.statusCode).toBe(200);
    const events = sseEvents(res.body);
    expect(events[0]?.type).toBe("start");
    const progresses = events.filter((e) => e.type === "progress");
    expect(progresses.length).toBeGreaterThan(0);
    expect(progresses[progresses.length - 1]).toMatchObject({ done: 5, total: 5 });
    const complete = events.find((e) => e.type === "complete") as { documentId: string; versionNo: number } | undefined;
    expect(complete?.versionNo).toBe(1);

    const doc = await app.inject({ method: "GET", url: `/api/documents/${complete?.documentId}` });
    expect(doc.json().data).toMatchObject({ type: "PRD", approvalState: "draft" });
    expect(doc.json().data.contentMd).toContain("FR-1");
    expect(doc.json().data.contentMd).toContain("## Kebutuhan Fungsional");
  });

  it("saves nothing when the model output is malformed", async () => {
    state.mode = "garbage";
    const res = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plan/generate/stream`,
      payload: { documentType: "PRD" },
    });
    const events = sseEvents(res.body);
    expect(events.some((e) => e.type === "error")).toBe(true);

    const list = await app.inject({ method: "GET", url: `/api/projects/${projectId}/documents` });
    expect(list.json().data.items).toHaveLength(0);
  });

  it("refuses to overwrite approved documents without the flag", async () => {
    await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/documents`,
      payload: { type: "TASKS", title: "Tugas", contentMd: "# lama" },
    });
    const docs = await app.inject({ method: "GET", url: `/api/projects/${projectId}/documents` });
    const id = docs.json().data.items[0].id as string;
    await app.inject({ method: "POST", url: `/api/documents/${id}/review` });
    await app.inject({ method: "POST", url: `/api/documents/${id}/approve` });

    const res = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plan/generate/stream`,
      payload: { documentType: "TASKS" },
    });
    expect(sseEvents(res.body).some((e) => e.type === "error" && (e as { code?: string }).code === "APPROVED_LOCKED")).toBe(true);

    const ok = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/plan/generate/stream`,
      payload: { documentType: "TASKS", fromApproved: true },
    });
    const complete = sseEvents(ok.body).find((e) => e.type === "complete") as { versionNo: number } | undefined;
    expect(complete?.versionNo).toBe(2);
  });

  it("answers questions with validated JSON", async () => {
    state.mode = "questions";
    const res = await app.inject({ method: "POST", url: `/api/projects/${projectId}/plan/questions` });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.questions).toEqual(["Untuk siapa?", "Batasan apa?"]);
  });

  it("rejects malformed questions honestly", async () => {
    state.mode = "bad-questions";
    const res = await app.inject({ method: "POST", url: `/api/projects/${projectId}/plan/questions` });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe("MALFORMED_STREAM");
  });
});
