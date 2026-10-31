import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { HttpError, errorBody } from "../http/errors.js";
import {
  buildStarterZip,
  getTemplateOrThrow,
  instantiateStarter,
  listStarterMetadata,
} from "../services/templateService.js";

const instantiateSchema = z
  .object({
    name: z.string().min(1).max(120),
    variables: z.record(z.string(), z.string().max(2000)).optional(),
    overwrite: z.boolean().default(false),
  })
  .strict();

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

export async function templateRoutes(app: FastifyInstance, db: AppDatabase): Promise<void> {
  app.get("/api/templates", async (_request, reply) => {
    return reply.send({ data: { items: listStarterMetadata() } });
  });

  app.get("/api/templates/:id", async (request, reply) => {
    try {
      const template = getTemplateOrThrow((request.params as { id: string }).id);
      return reply.send({
        data: {
          id: template.id,
          name: template.name,
          stack: template.stack,
          license: template.license,
          description: template.description,
          variables: template.variables,
          files: template.files.map((f) => f.path),
        },
      });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/templates/:id/download", async (request, reply) => {
    try {
      const query = request.query as { variables?: unknown };
      let variables: Record<string, string> | undefined;
      if (typeof query.variables === "string" && query.variables.length > 0) {
        try {
          const parsed = JSON.parse(query.variables) as unknown;
          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("bad variables");
          }
          variables = parsed as Record<string, string>;
        } catch {
          throw new HttpError("VALIDATION_ERROR", "variables must be a JSON object");
        }
      }
      const buffer = await buildStarterZip((request.params as { id: string }).id, variables);
      reply.header("Content-Type", "application/zip");
      reply.header("Content-Disposition", `attachment; filename="${(request.params as { id: string }).id}.zip"`);
      return reply.send(buffer);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post("/api/templates/:id/instantiate", async (request, reply) => {
    try {
      const input = instantiateSchema.parse(request.body ?? {});
      const result = await instantiateStarter(db, (request.params as { id: string }).id, input);
      return reply.code(201).send({ data: result });
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
