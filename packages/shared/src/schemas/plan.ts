import { z } from "zod";
import { documentTypeSchema } from "./document.js";

export const planDocumentTypeSchema = documentTypeSchema.exclude(["DESIGN_SPEC" as const]);

export const generateStreamRequestSchema = z
  .object({ documentType: planDocumentTypeSchema, fromApproved: z.boolean().default(false) })
  .strict();

export const questionsResponseSchema = z
  .object({ questions: z.array(z.string().min(1).max(500)).min(1).max(8) })
  .strict();

export type GenerateStreamRequest = z.infer<typeof generateStreamRequestSchema>;
