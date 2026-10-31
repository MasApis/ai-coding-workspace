import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "@workspace/shared";
import { backupFileSchema } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { HttpError, errorBody } from "../http/errors.js";
import { exportBackup, importBackup } from "../services/backupService.js";

function sendError(reply: FastifyReply, err: unknown): void {
  if (err instanceof HttpError) {
    void reply.code(err.statusCode).send(errorBody(err.code, err.message, err.details));
    return;
  }
  if (err instanceof z.ZodError) {
    void reply.code(422).send(errorBody("INVALID_BACKUP", "invalid backup archive", z.treeifyError(err)));
    return;
  }
  throw err;
}

export async function backupRoutes(app: FastifyInstance, db: AppDatabase): Promise<void> {
  app.get("/api/projects/:id/backup", async (request, reply) => {
    try {
      const backup = await exportBackup(db, (request.params as { id: string }).id);
      reply.header("Content-Type", "application/json; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="backup-${backup.project.slug}.json"`);
      return reply.send(backup);
    } catch (err) {
      return sendError(reply, err);
    }
  });

  app.post(
    "/api/projects/import",
    { bodyLimit: 10 * 1024 * 1024 },
    async (request, reply) => {
      try {
        const body = z.object({ backup: backupFileSchema }).parse(request.body ?? {});
        const result = await importBackup(db, body.backup);
        return reply.code(201).send({ data: result });
      } catch (err) {
        return sendError(reply, err);
      }
    },
  );
}
