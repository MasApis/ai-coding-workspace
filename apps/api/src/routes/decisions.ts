import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "@workspace/shared";
import { createDecisionSchema } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { HttpError, errorBody } from "../http/errors.js";
import { createDecision, listDecisions } from "../services/decisionService.js";

function sendError(reply: FastifyReply, err: unknown): void {
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

export async function decisionRoutes(app: FastifyInstance, db: AppDatabase): Promise<void> {
  app.get("/api/projects/:id/decisions", async (request, reply) => {
    try {
      const items = await listDecisions(db, (request.params as { id: string }).id);
      return reply.send({ data: { items } });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/projects/:id/decisions", async (request, reply) => {
    try {
      const input = createDecisionSchema.parse(request.body);
      const decision = await createDecision(db, (request.params as { id: string }).id, input);
      return reply.code(201).send({ data: decision });
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
