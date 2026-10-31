import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify, { type FastifyInstance } from "fastify";
import { openDatabase } from "./db/connection.js";
import { errorBody } from "./http/errors.js";
import { projectRoutes } from "./routes/projects.js";
import { providerRoutes } from "./routes/providers.js";
import { aiRoutes } from "./routes/ai.js";
import { backupRoutes } from "./routes/backup.js";
import { chatRoutes } from "./routes/chat.js";
import { conversationRoutes } from "./routes/conversations.js";
import { decisionRoutes } from "./routes/decisions.js";
import { designRoutes } from "./routes/design.js";
import { documentRoutes } from "./routes/documents.js";
import { templateRoutes } from "./routes/templates.js";
import { exportRoutes } from "./routes/exports.js";
import { planningRoutes } from "./routes/planning.js";
import { loadGatewayKey } from "./services/secrets.js";

const WEB_ORIGIN = process.env["WEB_ORIGIN"] ?? "http://127.0.0.1:5173";

export async function createApp(dbPath?: string, opts?: { gatewayKey?: Buffer }): Promise<FastifyInstance> {
  const path = dbPath ?? process.env["DB_PATH"] ?? "./data/workspace.sqlite";
  const { db, close } = openDatabase(path);
  const gatewayKey = opts?.gatewayKey ?? loadGatewayKey();

  const app = Fastify({ logger: false });
  app.decorate("db", db);
  app.addHook("onClose", (_instance, done) => {
    close();
    done();
  });

  await app.register(cors, { origin: [WEB_ORIGIN] });
  await app.register(helmet, { contentSecurityPolicy: false });

  app.get("/api/health", async (_request, reply) => {
    return reply.send({ data: { status: "ok" } });
  });

  await projectRoutes(app, db);
  await providerRoutes(app, db, gatewayKey);
  await aiRoutes(app, db, gatewayKey);
  await documentRoutes(app, db);
  await conversationRoutes(app, db);
  await decisionRoutes(app, db);
  await backupRoutes(app, db);
  await chatRoutes(app, db, gatewayKey);
  await designRoutes(app, db, gatewayKey);
  await templateRoutes(app, db);
  await exportRoutes(app, db);
  await planningRoutes(app, db, gatewayKey);

  app.setErrorHandler((err, _request, reply) => {
    if (reply.sent) return;
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      void reply.code(413).send(errorBody("PAYLOAD_TOO_LARGE", "request body exceeds the 10 MB limit"));
      return;
    }
    console.error(err);
    void reply.code(500).send(errorBody("INTERNAL_ERROR", "internal server error"));
  });

  return app;
}
