import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "@workspace/shared";
import { createDocumentSchema, createVersionSchema } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { HttpError, errorBody } from "../http/errors.js";
import {
  approveDocument,
  createDocument,
  createVersion,
  getDocument,
  listDocuments,
  listVersions,
  reviewDocument,
} from "../services/documentService.js";

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

export async function documentRoutes(app: FastifyInstance, db: AppDatabase): Promise<void> {
  app.get("/api/projects/:id/documents", async (request, reply) => {
    try {
      const items = await listDocuments(db, (request.params as { id: string }).id);
      return reply.send({ data: { items } });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/projects/:id/documents", async (request, reply) => {
    try {
      const input = createDocumentSchema.parse(request.body);
      const doc = await createDocument(db, (request.params as { id: string }).id, input);
      return reply.code(201).send({ data: doc });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/documents/:id", async (request, reply) => {
    try {
      return reply.send({ data: await getDocument(db, (request.params as { id: string }).id) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/documents/:id/versions", async (request, reply) => {
    try {
      const input = createVersionSchema.parse(request.body);
      const doc = await createVersion(db, (request.params as { id: string }).id, input);
      return reply.code(201).send({ data: doc });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/documents/:id/versions", async (request, reply) => {
    try {
      const items = await listVersions(db, (request.params as { id: string }).id);
      return reply.send({ data: { items } });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/documents/:id/review", async (request, reply) => {
    try {
      return reply.send({ data: await reviewDocument(db, (request.params as { id: string }).id) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/documents/:id/approve", async (request, reply) => {
    try {
      return reply.send({ data: await approveDocument(db, (request.params as { id: string }).id) });
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
