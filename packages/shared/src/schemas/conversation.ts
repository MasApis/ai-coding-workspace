import { z } from "zod";

export const messageRoleSchema = z.enum(["user", "assistant", "system"]);

export const contextManifestSchema = z.object({
  upstream: z.array(z.object({ documentId: z.string().min(1), versionNo: z.number().int().min(1) })).max(20),
});

export const createConversationSchema = z
  .object({
    projectId: z.string().min(1).max(200).optional(),
    title: z.string().min(1).max(200).optional(),
  })
  .strict();

export const createMessageSchema = z
  .object({
    role: messageRoleSchema,
    contentMd: z.string().min(1).max(200000),
    providerId: z.string().min(1).max(200).optional(),
    modelId: z.string().min(1).max(200).optional(),
    contextManifest: contextManifestSchema.optional(),
  })
  .strict();

export const chatStreamBodySchema = z
  .object({
    contentMd: z.string().min(1).max(200000),
    modelId: z.string().min(1).max(200).optional(),
    contextDocs: z
      .array(
        z.object({
          documentId: z.string().min(1).max(200),
          versionNo: z.number().int().min(1).optional(),
        }),
      )
      .max(10)
      .optional(),
  })
  .strict();

export type ChatStreamBody = z.infer<typeof chatStreamBodySchema>;

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export interface ConversationDto {
  id: string;
  projectId: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  contentMd: string;
  providerId: string | null;
  modelId: string | null;
  contextManifest: { upstream: Array<{ documentId: string; versionNo: number }> } | null;
  createdAt: string;
}
