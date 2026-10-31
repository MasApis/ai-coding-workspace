import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "@workspace/shared";
import { createExportRequestSchema } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { HttpError, errorBody } from "../http/errors.js";
import { createExport, getExportFile } from "../services/exportService.js";

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

export async function exportRoutes(app: FastifyInstance, db: AppDatabase): Promise<void> {
  app.post("/api/projects/:id/exports", async (request, reply) => {
    try {
      const input = createExportRequestSchema.parse(request.body ?? {});
      const { dto } = await createExport(db, (request.params as { id: string }).id, input.includeDrafts);
      return reply.code(201).send({ data: dto });
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.get("/api/exports/:id/download", async (request, reply) => {
    try {
      const { dto, absolutePath, filename } = await getExportFile(db, (request.params as { id: string }).id);
      if (!existsSync(absolutePath)) {
        throw new HttpError("EXPORT_NOT_FOUND", `export file is missing: ${dto.relativeFilePath}`);
      }
      // Document ZIPs are small; a buffered send keeps download testable.
      const buffer = await readFile(absolutePath);
      reply.header("Content-Type", "application/zip");
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);
      return reply.send(buffer);
    } catch (err) {
      return sendError(reply, err);
    }
  });
}
