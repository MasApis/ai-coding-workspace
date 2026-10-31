import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type {
  ConversationDto,
  CreateConversationInput,
  CreateMessageInput,
  MessageDto,
} from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { conversations, messages } from "../db/schema.js";
import { HttpError } from "../http/errors.js";
import { getProject } from "./projectService.js";

type ConversationRow = typeof conversations.$inferSelect;

function toConversationDto(row: ConversationRow): ConversationDto {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMessageDto(row: typeof messages.$inferSelect): MessageDto {
  let contextManifest: MessageDto["contextManifest"] = null;
  if (row.contextManifestJson) {
    try {
      const parsed = JSON.parse(row.contextManifestJson) as MessageDto["contextManifest"];
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.upstream)) {
        contextManifest = parsed;
      }
    } catch {
      contextManifest = null;
    }
  }
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as MessageDto["role"],
    contentMd: row.contentMd,
    providerId: row.providerId,
    modelId: row.modelId,
    contextManifest,
    createdAt: row.createdAt.toISOString(),
  };
}

async function requireConversation(db: AppDatabase, id: string): Promise<ConversationRow> {
  const row = await db.select().from(conversations).where(eq(conversations.id, id)).get();
  if (!row) throw new HttpError("CONVERSATION_NOT_FOUND", `conversation not found: ${id}`);
  return row;
}

export async function createConversation(db: AppDatabase, input: CreateConversationInput, projectId?: string): Promise<ConversationDto> {
  const resolvedProjectId = projectId ?? input.projectId ?? null;
  if (resolvedProjectId) {
    await getProject(db, resolvedProjectId);
  }
  const id = randomUUID();
  await db.insert(conversations).values({ id, projectId: resolvedProjectId, title: input.title ?? null }).run();
  return toConversationDto(await requireConversation(db, id));
}

export async function listConversations(db: AppDatabase, projectId?: string): Promise<ConversationDto[]> {
  if (projectId === undefined) {
    const rows = await db.select().from(conversations).where(isNull(conversations.projectId)).all();
    return rows.map(toConversationDto);
  }
  await getProject(db, projectId);
  const rows = await db.select().from(conversations).where(eq(conversations.projectId, projectId)).all();
  return rows.map(toConversationDto);
}

export async function getConversation(db: AppDatabase, id: string): Promise<ConversationDto> {
  return toConversationDto(await requireConversation(db, id));
}

export async function getScopedConversation(db: AppDatabase, projectId: string, id: string): Promise<ConversationDto> {
  await getProject(db, projectId);
  const row = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.projectId, projectId)))
    .get();
  if (!row) throw new HttpError("CONVERSATION_NOT_FOUND", `conversation not found: ${id}`);
  return toConversationDto(row);
}

export async function listMessages(db: AppDatabase, conversationId: string): Promise<MessageDto[]> {
  await requireConversation(db, conversationId);
  // Insertion order via SQLite rowid: message ids are random UUIDs,
  // and several messages can share the same created_at millisecond.
  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(sql`rowid`)
    .all();
  return rows.map(toMessageDto);
}

export async function createMessage(db: AppDatabase, conversationId: string, input: CreateMessageInput): Promise<MessageDto> {
  await requireConversation(db, conversationId);
  const id = randomUUID();
  await db
    .insert(messages)
    .values({
      id,
      conversationId,
      role: input.role,
      contentMd: input.contentMd,
      providerId: input.providerId ?? null,
      modelId: input.modelId ?? null,
      contextManifestJson: input.contextManifest ? JSON.stringify(input.contextManifest) : null,
    })
    .run();
  const row = await db.select().from(messages).where(eq(messages.id, id)).get();
  if (!row) throw new HttpError("INTERNAL_ERROR", "message was not saved");
  return toMessageDto(row);
}
