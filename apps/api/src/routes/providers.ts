import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "@workspace/shared";
import {
  createProviderSchema,
  updateModelsSchema,
  updatePreferencesSchema,
  updateProviderSchema,
} from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { HttpError, errorBody } from "../http/errors.js";
import {
  createProvider,
  deleteProvider,
  getPreferences,
  listProviders,
  replaceModels,
  setPreferences,
  updateProvider,
} from "../services/providerService.js";
import { getProject } from "../services/projectService.js";

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

export async function providerRoutes(app: FastifyInstance, db: AppDatabase, key: Buffer): Promise<void> {
  app.get("/api/providers", async (_request, reply) => {
    try {
      return reply.send({ data: { items: await listProviders(db) } });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/providers", async (request, reply) => {
    try {
      const input = createProviderSchema.parse(request.body);
      return reply.code(201).send({ data: await createProvider(db, key, input) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.patch("/api/providers/:id", async (request, reply) => {
    try {
      const input = updateProviderSchema.parse(request.body);
      return reply.send({ data: await updateProvider(db, key, (request.params as { id: string }).id, input) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.delete("/api/providers/:id", async (request, reply) => {
    try {
      await deleteProvider(db, (request.params as { id: string }).id);
      return reply.code(204).send();
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put("/api/providers/:id/models", async (request, reply) => {
    try {
      const input = updateModelsSchema.parse(request.body);
      const items = await replaceModels(db, (request.params as { id: string }).id, input.models);
      return reply.send({ data: { items } });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/ai/preferences", async (_request, reply) => {
    try {
      return reply.send({ data: await getPreferences(db, "global", null) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put("/api/ai/preferences", async (request, reply) => {
    try {
      const input = updatePreferencesSchema.parse(request.body);
      return reply.send({ data: await setPreferences(db, "global", null, input.providerId, input.modelId) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/projects/:id/ai-preferences", async (request, reply) => {
    try {
      const id = (request.params as { id: string }).id;
      await getProject(db, id);
      return reply.send({ data: await getPreferences(db, "project", id) });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.put("/api/projects/:id/ai-preferences", async (request, reply) => {
    try {
      const id = (request.params as { id: string }).id;
      await getProject(db, id);
      const input = updatePreferencesSchema.parse(request.body);
      return reply.send({ data: await setPreferences(db, "project", id, input.providerId, input.modelId) });
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
