import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { AnthropicAdapter } from "../src/ai/anthropic.js";
import { GeminiAdapter } from "../src/ai/gemini.js";
import { OllamaAdapter } from "../src/ai/ollama.js";
import { OpenAIAdapter } from "../src/ai/openai.js";
import type { ResolvedProviderConfig } from "../src/ai/types.js";

const SECRET = "sk-test-native-000";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "native-test-")), "test.sqlite");
}

const ANTH_STREAM = [
  'event: message_start',
  'data: {"type":"message_start","message":{"usage":{"input_tokens":2}}}',
  "",
  'event: content_block_delta',
  'data: {"type":"content_block_delta","delta":{"text":"Hai"}}',
  "",
  'event: message_delta',
  'data: {"type":"message_delta","usage":{"output_tokens":3}}',
  "",
  'event: message_stop',
  'data: {"type":"message_stop"}',
  "",
].join("\n");

const GEM_STREAM = [
  `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "Hai" }] } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2 } })}`,
  "",
].join("\n");

const OLLAMA_NDJSON =
  `${JSON.stringify({ message: { content: "Hai" }, done: false })}\n` +
  `${JSON.stringify({ message: { content: "" }, done: true, prompt_eval_count: 2, eval_count: 3 })}\n`;

function startVendorMock(): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      const url = req.url ?? "";
      // OpenAI native
      if (url === "/openai/models") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ data: [{ id: "gpt-4o-mini" }] }));
        return;
      }
      if (url === "/openai/chat/completions") {
        if (req.headers["authorization"] !== `Bearer ${SECRET}`) {
          res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { message: "Incorrect API key", code: "invalid_api_key" } }));
          return;
        }
        const parsed = JSON.parse(body) as { model?: string; stream?: boolean };
        if (parsed.model === "nope") {
          res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { message: "model nope not found", code: "model_not_found" } }));
          return;
        }
        if (parsed.stream === false) {
          res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ choices: [{ message: { content: "pong" } }] }));
          return;
        }
        res.writeHead(200, { "Content-Type": "text/event-stream" }).end(
          `data: ${JSON.stringify({ choices: [{ delta: { content: "Hai" } }] })}\n\ndata: [DONE]\n\n`,
        );
        return;
      }
      // Anthropic
      if (url === "/v1/messages") {
        if (req.headers["x-api-key"] !== SECRET) {
          res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
          return;
        }
        const parsed = JSON.parse(body) as { model?: string; stream?: boolean };
        if (parsed.model === "nope") {
          res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ type: "error", error: { type: "not_found_error", message: "model nope" } }));
          return;
        }
        if (parsed.stream === false) {
          res.writeHead(200, { "Content-Type": "application/json" }).end(
            JSON.stringify({ content: [{ text: "pong" }], usage: { input_tokens: 1, output_tokens: 1 } }),
          );
          return;
        }
        res.writeHead(200, { "Content-Type": "text/event-stream" }).end(ANTH_STREAM);
        return;
      }
      // Gemini
      if (url === "/v1beta/models") {
        if (req.headers["x-goog-api-key"] !== SECRET) {
          res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { code: 400, message: "API key not valid", status: "INVALID_ARGUMENT" } }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ models: [{ name: "models/gemini-x" }] }));
        return;
      }
      if (url.startsWith("/v1beta/models/") && url.includes(":streamGenerateContent")) {
        if (req.headers["x-goog-api-key"] !== SECRET) {
          res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { code: 400, message: "API key not valid", status: "INVALID_ARGUMENT" } }));
          return;
        }
        const model = url.split("/v1beta/models/")[1]?.split(":")[0];
        if (model === "nope") {
          res.writeHead(404, { "Content-Type": "application/json" }).end(JSON.stringify({ error: { code: 404, message: "model nope not found", status: "NOT_FOUND" } }));
          return;
        }
        res.writeHead(200, { "Content-Type": "text/event-stream" }).end(`${GEM_STREAM}\n`);
        return;
      }
      // Ollama
      if (url === "/api/tags") {
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ models: [{ name: "llama3" }] }));
        return;
      }
      if (url === "/api/chat") {
        const parsed = JSON.parse(body) as { model?: string; stream?: boolean };
        if (parsed.model === "nope") {
          res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "model 'nope' not found" }));
          return;
        }
        if (parsed.stream === false) {
          res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ message: { content: "pong" }, done: true }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/x-ndjson" }).end(OLLAMA_NDJSON);
        return;
      }
      res.writeHead(404).end();
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.address() as { port: number }).port }));
  });
}

function cfg(protocol: ResolvedProviderConfig["protocol"], port: number, base: string, credential: string | null = SECRET): ResolvedProviderConfig {
  void port;
  return { id: "p", label: "T", protocol, baseUrl: base, credential, enabled: true };
}

describe("native adapters", () => {
  let mock: { server: Server; port: number };

  beforeAll(async () => {
    mock = await startVendorMock();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  });

  const sig = () => new AbortController().signal;

  it("openai streams, lists, and maps auth/model errors", async () => {
    const adapter = new OpenAIAdapter();
    expect(adapter.capabilities().has("models-list")).toBe(true);
    const base = `http://127.0.0.1:${mock.port}/openai`;
    const events = [];
    for await (const e of adapter.streamChat(cfg("openai", mock.port, base), { model: "gpt-4o-mini", messages: [{ role: "user", content: "x" }], signal: sig(), maxOutputTokens: 8 })) {
      events.push(e);
    }
    expect(events).toEqual([{ type: "delta", text: "Hai" }, { type: "done" }]);

    const models = await adapter.listModels(cfg("openai", mock.port, base));
    expect(models).toEqual([{ id: "gpt-4o-mini" }]);

    const badAuth = await adapter
      .streamChat(cfg("openai", mock.port, base, "wrong"), { model: "m", messages: [{ role: "user", content: "x" }], signal: sig(), maxOutputTokens: 8 })
      .next()
      .then(
        () => ({ code: "none" }),
        (e: { code?: string }) => ({ code: e.code }),
      );
    expect(badAuth.code).toBe("UNAUTHORIZED");

    const test = await adapter.testConnection(cfg("openai", mock.port, base), "gpt-4o-mini");
    expect(test.ok).toBe(true);
  });

  it("openai refuses without a credential before any request", async () => {
    const adapter = new OpenAIAdapter();
    const err = await adapter
      .streamChat(cfg("openai", mock.port, `http://127.0.0.1:${mock.port}/openai`, null), { model: "m", messages: [{ role: "user", content: "x" }], signal: sig(), maxOutputTokens: 8 })
      .next()
      .then(
        () => ({ code: "none" }),
        (e: { code?: string }) => ({ code: e.code }),
      );
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("anthropic streams native events with normalized usage", async () => {
    const adapter = new AnthropicAdapter();
    expect(adapter.capabilities().has("models-list")).toBe(false);
    const base = `http://127.0.0.1:${mock.port}`;
    const events = [];
    for await (const e of adapter.streamChat(cfg("anthropic", mock.port, base), { model: "claude-x", messages: [{ role: "system", content: "S" }, { role: "user", content: "x" }], signal: sig(), maxOutputTokens: 8 })) {
      events.push(e);
    }
    expect(events).toEqual([
      { type: "usage", inputTokens: 2, outputTokens: undefined },
      { type: "delta", text: "Hai" },
      { type: "usage", inputTokens: undefined, outputTokens: 3 },
      { type: "done" },
    ]);

    const badModel = await adapter
      .streamChat(cfg("anthropic", mock.port, base), { model: "nope", messages: [{ role: "user", content: "x" }], signal: sig(), maxOutputTokens: 8 })
      .next()
      .then(
        () => ({ code: "none" }),
        (e: { code?: string }) => ({ code: e.code }),
      );
    expect(badModel.code).toBe("INVALID_MODEL");

    const test = await adapter.testConnection(cfg("anthropic", mock.port, base));
    expect(test).toEqual({ ok: false, message: expect.stringContaining("model ID"), modelsAvailable: false });
  });

  it("gemini streams with usage metadata and lists models", async () => {
    const adapter = new GeminiAdapter();
    const base = `http://127.0.0.1:${mock.port}/v1beta`;
    const events = [];
    for await (const e of adapter.streamChat(cfg("gemini", mock.port, base), { model: "gemini-x", messages: [{ role: "assistant", content: "old" }, { role: "user", content: "x" }], signal: sig(), maxOutputTokens: 8 })) {
      events.push(e);
    }
    expect(events).toEqual([
      { type: "delta", text: "Hai" },
      { type: "usage", inputTokens: 1, outputTokens: 2 },
      { type: "done" },
    ]);

    const models = await adapter.listModels(cfg("gemini", mock.port, base));
    expect(models).toEqual([{ id: "gemini-x" }]);

    const badKey = await adapter
      .streamChat(cfg("gemini", mock.port, base, "wrong"), { model: "gemini-x", messages: [{ role: "user", content: "x" }], signal: sig(), maxOutputTokens: 8 })
      .next()
      .then(
        () => ({ code: "none" }),
        (e: { code?: string }) => ({ code: e.code }),
      );
    expect(badKey.code).toBe("UNAUTHORIZED");
  });

  it("ollama streams ndjson, lists tags, and reports when missing", async () => {
    const adapter = new OllamaAdapter();
    const base = `http://127.0.0.1:${mock.port}`;
    const events = [];
    for await (const e of adapter.streamChat(cfg("ollama", mock.port, base, null), { model: "llama3", messages: [{ role: "user", content: "x" }], signal: sig(), maxOutputTokens: 8 })) {
      events.push(e);
    }
    expect(events).toEqual([
      { type: "delta", text: "Hai" },
      { type: "usage", inputTokens: 2, outputTokens: 3 },
      { type: "done" },
    ]);

    const models = await adapter.listModels(cfg("ollama", mock.port, base, null));
    expect(models).toEqual([{ id: "llama3" }]);

    const missing = await adapter
      .streamChat(cfg("ollama", 9, "http://127.0.0.1:9", null), { model: "llama3", messages: [{ role: "user", content: "x" }], signal: sig(), maxOutputTokens: 8 })
      .next()
      .then(
        () => ({ code: "none", message: "" }),
        (e: { code?: string; message?: string }) => ({ code: e.code, message: e.message }),
      );
    expect(missing.code).toBe("UPSTREAM_NETWORK");
    expect(missing.message).toContain("Ollama");
  });
});

describe("native protocols through the app registry", () => {
  let mock: { server: Server; port: number };
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeAll(async () => {
    mock = await startVendorMock();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => mock.server.close(() => resolve()));
  });

  beforeEach(async () => {
    app = await createApp(tempDbPath(), { gatewayKey: randomBytes(32) });
  });

  afterEach(async () => {
    await app.close();
  });

  it("streams chat through the anthropic adapter over SSE", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "A", protocol: "anthropic", baseUrl: `http://127.0.0.1:${mock.port}`, credential: SECRET },
    });
    const id = created.json().data.id as string;
    const res = await app.inject({
      method: "POST",
      url: "/api/ai/chat/stream",
      payload: { providerId: id, modelId: "claude-x", messages: [{ role: "user", content: "Hai" }] },
    });
    expect(res.statusCode).toBe(200);
    const texts = res.body.split("\n\n").filter(Boolean).map((line) => JSON.parse(line.replace(/^data: /, "")) as { type: string; text?: string });
    expect(texts.map((t) => t.type)).toContain("complete");
    expect(texts.filter((t) => t.type === "delta").map((t) => t.text).join("")).toBe("Hai");
    expect(res.body).not.toContain(SECRET);
  });
});
