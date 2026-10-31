import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "@workspace/shared";
import { generateStreamRequestSchema } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { GatewayError, gatewayHttpStatus } from "../ai/errors.js";
import { HttpError, errorBody } from "../http/errors.js";
import { getProject } from "../services/projectService.js";
import { generateDocumentSections, generateQuestions, saveGeneratedDocument } from "../services/planning/planningService.js";
import { PLAN_TYPE_SPECS } from "../services/planning/prompts.js";

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

export async function planningRoutes(app: FastifyInstance, db: AppDatabase, key: Buffer): Promise<void> {
  app.post("/api/projects/:id/plan/questions", async (request, reply) => {
    try {
      const id = (request.params as { id: string }).id;
      await getProject(db, id);
      const questions = await generateQuestions(db, key, id, AbortSignal.timeout(120000));
      return reply.send({ data: { questions } });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/projects/:id/plan/generate/stream", async (request, reply) => {
    let parsed;
    try {
      parsed = generateStreamRequestSchema.parse(request.body);
    } catch (err) {
      return sendError(reply, err);
    }
    const id = (request.params as { id: string }).id;
    try {
      await getProject(db, id);
    } catch (err) {
      return sendError(reply, err);
    }
    const spec = PLAN_TYPE_SPECS[parsed.documentType];
    if (!spec) {
      return sendError(reply, new GatewayError("PROVIDER_MISCONFIGURED", `unknown document type: ${parsed.documentType}`));
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

    send({ type: "start", requestId, documentType: parsed.documentType });
    try {
      const { markdown } = await generateDocumentSections(db, key, id, parsed.documentType, {
        signal: aborter.signal,
        onProgress: (done, total, heading) => {
          if (!raw.destroyed) send({ type: "progress", requestId, section: heading, done, total });
        },
      });
      const saved = await saveGeneratedDocument(db, id, parsed.documentType, spec.defaultTitle, markdown, parsed.fromApproved);
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
