import { z } from "zod";

export const chatRoleSchema = z.enum(["system", "user", "assistant"]);

export const chatMessageSchema = z
  .object({
    role: chatRoleSchema,
    content: z.string().min(1).max(200000),
  })
  .strict();

export const chatStreamRequestSchema = z
  .object({
    providerId: z.string().min(1).max(200).optional(),
    modelId: z.string().min(1).max(200).optional(),
    projectId: z.string().min(1).max(200).optional(),
    messages: z.array(chatMessageSchema).min(1).max(100),
    maxOutputTokens: z.number().int().min(1).max(8192).default(1024),
  })
  .strict();

export type ChatStreamRequest = z.infer<typeof chatStreamRequestSchema>;

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  modelsAvailable: boolean;
}
