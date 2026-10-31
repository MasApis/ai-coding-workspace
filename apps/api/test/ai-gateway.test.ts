import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { OpenAICompatibleAdapter } from "../src/ai/openaiCompatible.js";

const SECRET = "sk-test-gateway-secret-999";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "gateway-test-")), "test.sqlite");
}

async function catchCode(promise: Promise<unknown>): Promise<{ code?: unknown }> {
  try {
    await promise;
    return {};
  } catch (err) {
    return err as { code?: unknown };
  }
}

function sse(events: string[]): string {
  return events.map((e) => `data: ${e}\n\n`).join("") + "data: [DONE]\n\n";
}

const OK_STREAM = sse([
  JSON.stringify({ choices: [{ delta: { role: "assistant" } }] }),
  JSON.stringify({ choices: [{ delta: { content: "Halo" } }] }),
  JSON.stringify({ choices: [{ delta: { content: " dunia" } }], usage: { prompt_tokens: 3, completion_tokens: 2 } }),
]);

interface MockState {
  mode: "ok" | "badkey" | "missing" | "malformed" | "slow" | "badmodels" | "hang";
  aborted: boolean;
  lastAuth: string | null;
}

function startMock(state: MockState): Promise<{ server: Server; port: number }> {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    state.lastAuth = (req.headers["authorization"] as string) ?? null;
    let finished = false;
    res.on("finish", () => {
      finished = true;
    });
    res.on("close", () => {
      if (!finished) state.aborted = true;
    });
    if (req.url === "/v1/models") {
      if (state.mode === "badmodels") {
        res.writeHead(500, { "Content-Type": "application/json" }).end("{}");
      } else {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ data: [{ id: "mock-1" }] }));
      }
      return;
    }
    if (req.url === "/v1/chat/completions") {
      let body = "";
      req.on("data", (c) => {
        body += c;
      });
      req.on("end", () => {
        if (state.mode === "badkey") {
          res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { message: "Incorrect API key", code: "invalid_api_key" } }));
        } else if (state.mode === "missing") {
          res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { message: "model mock-nope does not exist", code: "model_not_found" } }));
        } else if (state.mode === "malformed") {
          res.writeHead(200, { "Content-Type": "text/event-stream" }).end("this is not sse\n\n");
        } else if (state.mode === "slow") {
          setTimeout(() => {
            if (!res.destroyed) {
              res.writeHead(200, { "Content-Type": "text/event-stream" }).end(OK_STREAM);
            }
          }, 1500);
        } else if (state.mode === "hang") {
          res.writeHead(200, { "Content-Type": "text/event-stream" });
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "Halo" } }] })}\n\n`);
        } else {
          let stream = true;
          try {
            stream = (JSON.parse(body) as { stream?: unknown }).stream !== false;
          } catch {
            stream = true;
          }
          if (stream) {
            res.writeHead(200, { "Content-Type": "text/event-stream" }).end(OK_STREAM);
          } else {
            res
              .writeHead(200, { "Content-Type": "application/json" })
              .end(JSON.stringify({ choices: [{ message: { content: "pong" } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
          }
        }
      });
      return;
    }
    res.writeHead(404).end();
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, port: (server.address() as { port: number }).port });
    });
  });
}

describe("openai-compatible adapter", () => {
  let mock: { server: Server; port: number };
  let state: MockState;
  const adapter = new OpenAICompatibleAdapter();

  beforeAll(async () => {
    state = { mode: "ok", aborted: false, lastAuth: null };
    mock = await startMock(state);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  });

  beforeEach(() => {
    state.mode = "ok";
    state.aborted = false;
    state.lastAuth = null;
  });

  const config = (port: number) => ({
    id: "p1",
    label: "Mock",
    protocol: "openai-compatible" as const,
    baseUrl: `http://127.0.0.1:${port}/v1`,
    credential: SECRET,
    enabled: true,
  });

  it("streams deltas and usage to done", async () => {
    const events = [];
    for await (const e of adapter.streamChat(config(mock.port), {
      model: "mock-1",
      messages: [{ role: "user", content: "Hai" }],
      signal: new AbortController().signal,
      maxOutputTokens: 64,
    })) {
      events.push(e);
    }
    expect(events).toEqual([
      { type: "delta", text: "Halo" },
      { type: "delta", text: " dunia" },
      { type: "usage", inputTokens: 3, outputTokens: 2 },
      { type: "done" },
    ]);
    expect(state.lastAuth).toBe(`Bearer ${SECRET}`);
  });

  it("maps bad credentials without leaking the secret", async () => {
    state.mode = "badkey";
    const err = await catchCode(
      adapter
        .streamChat(config(mock.port), {
          model: "mock-1",
          messages: [{ role: "user", content: "Hai" }],
          signal: new AbortController().signal,
          maxOutputTokens: 64,
        })
        .next(),
    );
    expect(err.code).toBe("UNAUTHORIZED");
    expect((err as Error).message).not.toContain(SECRET);
  });

  it("maps missing models and malformed streams", async () => {
    state.mode = "missing";
    const missing = await catchCode(
      adapter
        .streamChat(config(mock.port), { model: "mock-nope", messages: [{ role: "user", content: "x" }], signal: new AbortController().signal, maxOutputTokens: 64 })
        .next(),
    );
    expect(missing.code).toBe("INVALID_MODEL");

    state.mode = "malformed";
    const malformed = await catchCode(
      adapter
        .streamChat(config(mock.port), { model: "mock-1", messages: [{ role: "user", content: "x" }], signal: new AbortController().signal, maxOutputTokens: 64 })
        .next(),
    );
    expect(malformed.code).toBe("MALFORMED_STREAM");
  });

  it("propagates client cancellation upstream", async () => {
    state.mode = "hang";
    const controller = new AbortController();
    const gen = adapter.streamChat(
      config(mock.port),
      { model: "mock-1", messages: [{ role: "user", content: "x" }], signal: controller.signal, maxOutputTokens: 64 },
      { connectTimeoutMs: 2000, idleTimeoutMs: 5000, totalTimeoutMs: 10000 },
    );
    const first = await gen.next();
    expect(first.value).toEqual({ type: "delta", text: "Halo" });
    controller.abort(new Error("user-cancel"));
    const result = await gen.next().catch((e) => e);
    expect(String(result)).toContain("user-cancel");
    for (let i = 0; i < 50 && !state.aborted; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(state.aborted).toBe(true);
  });

  it("times out on a stalled upstream", async () => {
    state.mode = "slow";
    const err = await catchCode(
      adapter
        .streamChat(
          config(mock.port),
          { model: "mock-1", messages: [{ role: "user", content: "x" }], signal: new AbortController().signal, maxOutputTokens: 64 },
          { connectTimeoutMs: 500, idleTimeoutMs: 200, totalTimeoutMs: 2000 },
        )
        .next(),
    );
    expect(err.code).toBe("UPSTREAM_TIMEOUT");
  });

  it("rejects non-routable remote targets", async () => {
    const err = await catchCode(
      adapter
        .streamChat(
          { id: "p", label: "X", protocol: "openai-compatible", baseUrl: "https://10.0.0.1:9/v1", credential: null, enabled: true },
          { model: "m", messages: [{ role: "user", content: "x" }], signal: new AbortController().signal, maxOutputTokens: 8 },
        )
        .next(),
    );
    expect(err.code).toBe("REMOTE_BLOCKED");
  });
});

describe("ai routes", () => {
  let mock: { server: Server; port: number };
  let state: MockState;
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    state = { mode: "ok", aborted: false, lastAuth: null };
    mock = await startMock(state);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  });

  beforeEach(async () => {
    state.mode = "ok";
    app = await createApp(tempDbPath(), { gatewayKey: randomBytes(32) });
  });

  afterEach(async () => {
    await app.close();
  });

  async function addProvider(mode: "openai-compatible" = "openai-compatible"): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "Mock", protocol: mode, baseUrl: `http://127.0.0.1:${mock.port}/v1`, credential: SECRET },
    });
    return res.json().data.id as string;
  }

  it("tests connections and lists models", async () => {
    const id = await addProvider();
    const test = await app.inject({ method: "POST", url: `/api/providers/${id}/test`, payload: { modelId: "mock-1" } });
    expect(test.statusCode).toBe(200);
    expect(test.json().data).toMatchObject({ ok: true });
    expect(test.body).not.toContain(SECRET);

    const models = await app.inject({ method: "GET", url: `/api/providers/${id}/models` });
    expect(models.json().data).toMatchObject({ items: [{ id: "mock-1" }], modelsAvailable: true });
  });

  it("degrades gracefully when the model list is unavailable", async () => {
    const id = await addProvider();
    state.mode = "badmodels";
    const models = await app.inject({ method: "GET", url: `/api/providers/${id}/models` });
    expect(models.json().data).toEqual({ items: [], modelsAvailable: false });
  });

  it("reports failed test connections honestly", async () => {
    const id = await addProvider();
    state.mode = "badkey";
    const test = await app.inject({ method: "POST", url: `/api/providers/${id}/test`, payload: { modelId: "mock-1" } });
    expect(test.json().data.ok).toBe(false);
    expect(test.body).not.toContain(SECRET);
  });

  it("streams chat over SSE end to end", async () => {
    const id = await addProvider();
    const res = await app.inject({
      method: "POST",
      url: "/api/ai/chat/stream",
      payload: { providerId: id, modelId: "mock-1", messages: [{ role: "user", content: "Hai" }] },
    });
    expect(res.statusCode).toBe(200);
    const events = res.body.split("\n\n").filter(Boolean).map((line) => JSON.parse(line.replace(/^data: /, "")) as { type: string; text?: string });
    expect(events[0]?.type).toBe("start");
    expect(events.map((e) => e.type)).toContain("complete");
    expect(events.filter((e) => e.type === "delta").map((e) => e.text).join("")).toBe("Halo dunia");
    expect(res.body).not.toContain(SECRET);
  });

  it("requires a configured provider", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/ai/chat/stream",
      payload: { messages: [{ role: "user", content: "Hai" }] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("NO_PROVIDER_CONFIGURED");
  });
});
