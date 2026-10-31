import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "@workspace/shared";
import { chatStreamBodySchema } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { GatewayError, gatewayHttpStatus } from "../ai/errors.js";
import { resolveChatTarget } from "../ai/gateway.js";
import { getAdapter } from "../ai/registry.js";
import type { ChatMessage } from "../ai/types.js";
import { HttpError, errorBody } from "../http/errors.js";
import { createMessage, getConversation, listMessages } from "../services/conversationService.js";

function sendError(reply: FastifyReply, err: unknown): void {
  if (err instanceof GatewayError) {
    void reply.code(gatewayHttpStatus(err.code)).send(errorBody(err.code, err.message));
    return;
  }
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

const SYSTEM_PROMPT = [
  "Anda asisten pengembang yang membantu dalam Bahasa Indonesia.",
  "Jawab ringkas dan konkret. Format Markdown ringan bila membantu.",
  "Jangan mengeksekusi, mengubah, atau meminta perubahan file apa pun.",
].join("\n");

export async function chatRoutes(app: FastifyInstance, db: AppDatabase, key: Buffer): Promise<void> {
  app.post("/api/conversations/:id/messages/stream", async (request, reply) => {
    let parsed;
    try {
      parsed = chatStreamBodySchema.parse(request.body);
    } catch (err) {
      return sendError(reply, err);
    }
    const id = (request.params as { id: string }).id;

    let conversation;
    try {
      conversation = await getConversation(db, id);
    } catch (err) {
      return sendError(reply, err);
    }

    let userMessageId: string;
    try {
      const saved = await createMessage(db, id, { role: "user", contentMd: parsed.contentMd });
      userMessageId = saved.id;
    } catch (err) {
      return sendError(reply, err);
    }

    const history = await listMessages(db, id);
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.contentMd }) as ChatMessage),
    ];

    let target;
    try {
      target = await resolveChatTarget(db, key, {
        providerId: undefined,
        modelId: parsed.modelId,
        projectId: conversation.projectId ?? undefined,
        messages,
        maxOutputTokens: 1024,
      });
    } catch (err) {
      return sendError(reply, err);
    }

    reply.hijack();
    const requestId = randomUUID();
    const raw = reply.raw;
    raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no-cache",
    });
    const send = (obj: unknown): void => {
      raw.write(`data: ${JSON.stringify(obj)}\n\n`);
    };
    const aborter = new AbortController();
    const onClose = (): void => {
      aborter.abort(new Error("client-disconnected"));
    };
    request.raw.on("close", onClose);

    send({ type: "start", requestId, messageId: userMessageId, providerId: target.config.id, model: target.target.model });
    const adapter = getAdapter(target.config.protocol);
    let text = "";
    try {
      for await (const event of adapter.streamChat(
        target.config,
        { model: target.target.model, messages: target.target.messages, signal: aborter.signal, maxOutputTokens: 1024 },
        undefined,
      )) {
        if (event.type === "delta" && event.text) {
          text += event.text;
          if (!raw.destroyed) send({ type: "delta", requestId, text: event.text });
        } else if (event.type === "usage" && !raw.destroyed) {
          send({ type: "usage", requestId, inputTokens: event.inputTokens, outputTokens: event.outputTokens });
        }
      }
      if (!text) {
        throw new GatewayError("UPSTREAM_ERROR", "provider returned an empty response");
      }
      const saved = await createMessage(db, id, {
        role: "assistant",
        contentMd: text,
        providerId: target.config.id,
        modelId: target.target.model,
      });
      if (!raw.destroyed) send({ type: "complete", requestId, messageId: saved.id });
    } catch (err) {
      if (!raw.destroyed) {
        if (err instanceof GatewayError) {
          send({ type: "error", requestId, code: err.code, message: err.message });
        } else if (!aborter.signal.aborted) {
          send({ type: "error", requestId, code: "UPSTREAM_ERROR", message: "streaming failed" });
        } else {
          send({ type: "cancelled", requestId });
        }
      }
    } finally {
      request.raw.off("close", onClose);
      raw.end();
    }
  });
}
