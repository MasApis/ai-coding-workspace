import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "@workspace/shared";
import { generateDesignRequestSchema } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { GatewayError, gatewayHttpStatus } from "../ai/errors.js";
import { HttpError, errorBody } from "../http/errors.js";
import { getProject } from "../services/projectService.js";
import { generateDesignSpec } from "../services/design/designService.js";
import { generatePrototype, getLatestPrototype, readPrototypeFile } from "../services/design/prototype.js";

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

export async function designRoutes(app: FastifyInstance, db: AppDatabase, key: Buffer): Promise<void> {
  app.get("/api/projects/:id/design/prototype", async (request, reply) => {
    try {
      return reply.send({ data: await getLatestPrototype(db, (request.params as { id: string }).id) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/projects/:id/design/prototype", async (request, reply) => {
    try {
      return reply.code(201).send({ data: await generatePrototype(db, (request.params as { id: string }).id) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/projects/:id/design/prototype/download", async (request, reply) => {
    try {
      const latest = await getLatestPrototype(db, (request.params as { id: string }).id);
      const buffer = readPrototypeFile(latest.relativePath);
      reply.header("Content-Type", "text/html; charset=utf-8");
      reply.header("Content-Security-Policy", "sandbox");
      reply.header("Content-Disposition", 'attachment; filename="index.html"');
      return reply.send(buffer);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/projects/:id/design/generate/stream", async (request, reply) => {
    let parsed;
    try {
      parsed = generateDesignRequestSchema.parse(request.body ?? {});
    } catch (err) {
      return sendError(reply, err);
    }
    const id = (request.params as { id: string }).id;
    try {
      await getProject(db, id);
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
      "X-Accel-Buffering": "no-cache",
    });
    const send = (obj: unknown): void => {
      raw.write(`data: ${JSON.stringify(obj)}\n\n`);
    };
    const aborter = new AbortController();
    const onClose = (): void => {
      aborter.abort(new Error("client-disconnected"));
    };
    request.raw.on("close", onClose);

    send({ type: "start", requestId });
    try {
      const saved = await generateDesignSpec(db, key, id, {
        signal: aborter.signal,
        fromApproved: parsed.fromApproved,
        onProgress: (done, total, heading) => {
          if (!raw.destroyed) send({ type: "progress", requestId, section: heading, done, total });
        },
      });
      if (!raw.destroyed) send({ type: "complete", requestId, documentId: saved.documentId, versionNo: saved.versionNo });
    } catch (err) {
      if (!raw.destroyed) {
        if (err instanceof GatewayError) {
          send({ type: "error", requestId, code: err.code, message: err.message });
        } else if (err instanceof HttpError) {
          send({ type: "error", requestId, code: err.code, message: err.message });
        } else if (!aborter.signal.aborted) {
          send({ type: "error", requestId, code: "UPSTREAM_ERROR", message: "generation failed" });
        } else {
          send({ type: "cancelled", requestId });
        }
      }
    } finally {
      request.raw.off("close", onClose);
      raw.end();
    }
  });
}
