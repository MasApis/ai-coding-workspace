import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "@workspace/shared";
import { createConversationSchema, createMessageSchema } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { HttpError, errorBody } from "../http/errors.js";
import {
  createConversation,
  createMessage,
  getConversation,
  getScopedConversation,
  listConversations,
  listMessages,
} from "../services/conversationService.js";

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

export async function conversationRoutes(app: FastifyInstance, db: AppDatabase): Promise<void> {
  app.get("/api/projects/:id/conversations", async (request, reply) => {
    try {
      const items = await listConversations(db, (request.params as { id: string }).id);
      return reply.send({ data: { items } });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/projects/:id/conversations", async (request, reply) => {
    try {
      const input = createConversationSchema.parse((request.body ?? {}) as unknown);
      const conversation = await createConversation(db, input, (request.params as { id: string }).id);
      return reply.code(201).send({ data: conversation });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/projects/:projectId/conversations/:conversationId", async (request, reply) => {
    try {
      const params = request.params as { projectId: string; conversationId: string };
      return reply.send({ data: await getScopedConversation(db, params.projectId, params.conversationId) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/conversations", async (request, reply) => {
    try {
      const query = request.query as { projectId?: unknown };
      const projectId = typeof query.projectId === "string" && query.projectId.length > 0 ? query.projectId : undefined;
      const items = await listConversations(db, projectId);
      return reply.send({ data: { items } });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/conversations", async (request, reply) => {
    try {
      const input = createConversationSchema.parse((request.body ?? {}) as unknown);
      return reply.code(201).send({ data: await createConversation(db, input) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/conversations/:id", async (request, reply) => {
    try {
      return reply.send({ data: await getConversation(db, (request.params as { id: string }).id) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/conversations/:id/messages", async (request, reply) => {
    try {
      const items = await listMessages(db, (request.params as { id: string }).id);
      return reply.send({ data: { items } });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/conversations/:id/messages", async (request, reply) => {
    try {
      const input = createMessageSchema.parse(request.body);
      const message = await createMessage(db, (request.params as { id: string }).id, input);
      return reply.code(201).send({ data: message });
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
