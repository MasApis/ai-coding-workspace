import { z } from "zod";
import { documentTypeSchema, versionOriginSchema } from "./document.js";
import { messageRoleSchema } from "./conversation.js";

export const BACKUP_VERSION = 1;

const nullableText = z.string().nullable();

const backupVersionSchema = z.object({
  versionNo: z.number().int().min(1),
  contentMd: z.string().max(500000),
  origin: versionOriginSchema,
});

const backupDocumentSchema = z.object({
  type: documentTypeSchema,
  title: z.string().min(1).max(200),
  approvalState: z.enum(["draft", "reviewed", "approved"]),
  upstreamManifest: z
    .object({ upstream: z.array(z.object({ documentType: z.string(), versionNo: z.number().int() })) })
    .nullable(),
  versions: z.array(backupVersionSchema).min(1).max(1000),
});

const backupDecisionSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  rationale: z.string().nullable(),
});

const backupTaskSchema = z.object({
  ticketKey: z.string().nullable(),
  title: z.string().min(1),
  descriptionMd: z.string().nullable(),
  priority: z.string().nullable(),
  state: z.string().nullable(),
  dependencyKeysJson: z.string().nullable(),
  acceptanceJson: z.string().nullable(),
});

const backupMessageSchema = z.object({
  role: messageRoleSchema,
  contentMd: z.string(),
  providerId: z.string().nullable(),
  modelId: z.string().nullable(),
  contextManifest: z.unknown().nullable(),
});

const backupConversationSchema = z.object({
  title: z.string().nullable(),
  messages: z.array(backupMessageSchema).max(10000),
});

export const backupFileSchema = z
  .object({
    schemaVersion: z.literal(BACKUP_VERSION),
    exportedAt: z.string(),
    project: z.object({
      name: z.string().min(1).max(120),
      slug: z.string().min(1).max(120),
      description: nullableText,
      ideaMd: nullableText,
      state: z.enum(["active", "archived"]),
    }),
    documents: z.array(backupDocumentSchema).max(100),
    decisions: z.array(backupDecisionSchema).max(1000),
    tasks: z.array(backupTaskSchema).max(5000),
    conversations: z.array(backupConversationSchema).max(1000),
    preferences: z.array(z.object({ modelId: z.string().min(1).max(200), providerLabel: z.string().nullable() })).max(10),
    designVersions: z
      .array(z.object({ versionNo: z.number().int().min(1), specMd: z.string().max(500000) }))
      .max(100),
  })
  .strict();

export type BackupFile = z.infer<typeof backupFileSchema>;

export interface ImportResult {
  projectId: string;
  projectSlug: string;
  counts: { documents: number; versions: number; decisions: number; tasks: number; conversations: number; messages: number };
  warnings: string[];
}
