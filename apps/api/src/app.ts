import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { openDatabase } from "./db/connection.js";
import { errorBody } from "./http/errors.js";
import { projectRoutes } from "./routes/projects.js";
import { providerRoutes } from "./routes/providers.js";
import { aiRoutes } from "./routes/ai.js";
import { documentRoutes } from "./routes/documents.js";
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

  app.get("/api/health", async (_request, reply) => {
    return reply.send({ data: { status: "ok" } });
  });

  await projectRoutes(app, db);
  await providerRoutes(app, db, gatewayKey);
  await aiRoutes(app, db, gatewayKey);
  await documentRoutes(app, db);

  app.setErrorHandler((err, _request, reply) => {
    if (reply.sent) return;
    console.error(err);
    void reply.code(500).send(errorBody("INTERNAL_ERROR", "internal server error"));
  });

  return app;
}
