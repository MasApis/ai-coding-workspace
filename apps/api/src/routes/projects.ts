import type { FastifyInstance, FastifyReply } from "fastify";
import {
  createProjectSchema,
  projectListQuerySchema,
  updateProjectSchema,
  z,
} from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { HttpError, errorBody } from "../http/errors.js";
import { createProject, deleteProject, getProjectWithSummary, listProjectsWithSummary, updateProject } from "../services/projectService.js";

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

export async function projectRoutes(app: FastifyInstance, db: AppDatabase): Promise<void> {
  app.get("/api/projects", async (request, reply) => {
    try {
      const query = projectListQuerySchema.parse(request.query);
      const items = await listProjectsWithSummary(db, query.state);
      return reply.send({ data: { items } });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/projects", async (request, reply) => {
    try {
      const input = createProjectSchema.parse(request.body);
      const project = await createProject(db, input);
      return reply.code(201).send({ data: project });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/projects/:id", async (request, reply) => {
    try {
      const project = await getProjectWithSummary(db, (request.params as { id: string }).id);
      return reply.send({ data: project });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.patch("/api/projects/:id", async (request, reply) => {
    try {
      const input = updateProjectSchema.parse(request.body);
      const project = await updateProject(db, (request.params as { id: string }).id, input);
      return reply.send({ data: project });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.delete("/api/projects/:id", async (request, reply) => {
    try {
      await deleteProject(db, (request.params as { id: string }).id);
      return reply.code(204).send();
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
