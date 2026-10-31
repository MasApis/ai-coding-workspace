import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "@workspace/shared";
import { chatStreamRequestSchema, updatePreferencesSchema } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { GatewayError, gatewayHttpStatus } from "../ai/errors.js";
import { getEffectiveSelection, resolveChatTarget, streamChatEvents } from "../ai/gateway.js";
import { getAdapter } from "../ai/registry.js";
import { readCredential } from "../services/providerService.js";
import { clearPreferences, getPreferences, setPreferences } from "../services/providerService.js";
import { recordAiRequest, getUsageSummary } from "../services/aiUsage.js";
import { HttpError, errorBody } from "../http/errors.js";
import { getProject } from "../services/projectService.js";
import { providerConfigs } from "../db/schema.js";
import { eq } from "drizzle-orm";

function sendError(reply: FastifyReply, err: unknown): void {
  if (err instanceof GatewayError) {
    void reply.code(gatewayHttpStatus(err.code)).send(errorBody(err.code, err.message));
    return;
  }
  if (err instanceof HttpError) {
    void reply.code(err.statusCode).send(errorBody(err.code, err.message, err.details));
    return;
  }
  if (err instanceof z.ZodError) {
    void reply.code(422).send(errorBody("VALIDATION_ERROR", "invalid input", z.treeifyError(err)));
    return;
  }
  throw err;
}

async function loadAdapterTarget(db: AppDatabase, key: Buffer, id: string) {
  const row = await db.select().from(providerConfigs).where(eq(providerConfigs.id, id)).get();
  if (!row) throw new HttpError("PROVIDER_NOT_FOUND", `provider not found: ${id}`);
  const adapter = getAdapter(row.protocol as "openai-compatible" | "openai" | "anthropic" | "gemini" | "ollama");
  return {
    adapter,
    config: {
      id: row.id,
      label: row.label,
      protocol: row.protocol as "openai-compatible" | "openai" | "anthropic" | "gemini" | "ollama",
      baseUrl: row.baseUrl,
      credential: await readCredential(db, key, row.id),
      enabled: row.enabled,
    },
  };
}

export async function aiRoutes(app: FastifyInstance, db: AppDatabase, key: Buffer): Promise<void> {
  app.post("/api/providers/:id/test", async (request, reply) => {
    try {
      const id = (request.params as { id: string }).id;
      const body = (request.body ?? {}) as { modelId?: unknown };
      const modelId = typeof body.modelId === "string" && body.modelId.length > 0 ? body.modelId : undefined;
      const { adapter, config } = await loadAdapterTarget(db, key, id);
      return reply.send({ data: await adapter.testConnection(config, modelId) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/providers/:id/models", async (request, reply) => {
    try {
      const id = (request.params as { id: string }).id;
      const { adapter, config } = await loadAdapterTarget(db, key, id);
      try {
        const items = await adapter.listModels(config);
        return reply.send({ data: { items, modelsAvailable: true } });
      } catch {
        return reply.send({ data: { items: [], modelsAvailable: false } });
      }
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/ai/resolved", async (request, reply) => {
    try {
      const query = request.query as { projectId?: unknown };
      const projectId = typeof query.projectId === "string" && query.projectId.length > 0 ? query.projectId : undefined;
      const selection = await getEffectiveSelection(db, { projectId });
      if (!selection) {
        return reply.code(404).send(errorBody("NO_PROVIDER_CONFIGURED", "no provider configured; add one in Settings first"));
      }
      return reply.send({ data: selection });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/ai/usage", async (request, reply) => {
    try {
      const query = request.query as { projectId?: unknown };
      const projectId = typeof query.projectId === "string" && query.projectId.length > 0 ? query.projectId : undefined;
      return reply.send({ data: await getUsageSummary(db, projectId) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/ai/fallback", async (_request, reply) => {
    try {
      return reply.send({ data: await getPreferences(db, "global-fallback", null) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put("/api/ai/fallback", async (request, reply) => {
    try {
      const input = updatePreferencesSchema.parse(request.body);
      return reply.send({ data: await setPreferences(db, "global-fallback", null, input.providerId, input.modelId) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.delete("/api/ai/fallback", async (_request, reply) => {
    try {
      await clearPreferences(db, "global-fallback", null);
      return reply.code(204).send();
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/projects/:id/ai-fallback", async (request, reply) => {
    try {
      const id = (request.params as { id: string }).id;
      await getProject(db, id);
      return reply.send({ data: await getPreferences(db, "project-fallback", id) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put("/api/projects/:id/ai-fallback", async (request, reply) => {
    try {
      const id = (request.params as { id: string }).id;
      await getProject(db, id);
      const input = updatePreferencesSchema.parse(request.body);
      return reply.send({ data: await setPreferences(db, "project-fallback", id, input.providerId, input.modelId) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.delete("/api/projects/:id/ai-fallback", async (request, reply) => {
    try {
      const id = (request.params as { id: string }).id;
      await getProject(db, id);
      await clearPreferences(db, "project-fallback", id);
      return reply.code(204).send();
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/ai/chat/stream", async (request, reply) => {
    let parsed;
    try {
      parsed = chatStreamRequestSchema.parse(request.body);
    } catch (err) {
      return sendError(reply, err);
    }
    let target;
    try {
      target = await resolveChatTarget(db, key, parsed);
    } catch (err) {
      return sendError(reply, err);
    }

    reply.hijack();
    const requestId = randomUUID();
    const raw = reply.raw;
    raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const send = (obj: unknown): void => {
      raw.write(`data: ${JSON.stringify(obj)}\n\n`);
    };
    const aborter = new AbortController();
    const onClose = (): void => {
      aborter.abort(new Error("client-disconnected"));
    };
    request.raw.on("close", onClose);

    send({ type: "start", requestId, providerId: target.config.id, model: target.target.model });
    const startedAt = new Date();
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    try {
      for await (const event of streamChatEvents(db, key, parsed, aborter.signal)) {
        if (event.type === "done") {
          send({ type: "complete", requestId });
        } else if (event.type === "delta") {
          send({ type: "delta", requestId, text: event.text });
        } else {
          inputTokens = event.inputTokens ?? inputTokens;
          outputTokens = event.outputTokens ?? outputTokens;
          send({ type: "usage", requestId, inputTokens: event.inputTokens, outputTokens: event.outputTokens });
        }
      }
      await recordAiRequest(db, {
        projectId: parsed.projectId ?? null,
        providerId: target.config.id,
        modelId: target.target.model,
        status: "ok",
        startedAt,
        inputTokens,
        outputTokens,
      });
    } catch (err) {
      if (!aborter.signal.aborted) {
        await recordAiRequest(db, {
          projectId: parsed.projectId ?? null,
          providerId: target.config.id,
          modelId: target.target.model,
          status: "error",
          errorCode: err instanceof GatewayError ? err.code : "UPSTREAM_ERROR",
          startedAt,
        });
      }
      if (err instanceof GatewayError) {
        if (!raw.destroyed) send({ type: "error", requestId, code: err.code, message: err.message });
      } else if (!aborter.signal.aborted) {
        if (!raw.destroyed) {
          send({ type: "error", requestId, code: "UPSTREAM_ERROR", message: "streaming failed" });
        }
      }
    } finally {
      request.raw.off("close", onClose);
      raw.end();
    }
  });
}
