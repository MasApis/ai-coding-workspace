import { z } from "zod";

export const documentTypeSchema = z.enum([
  "PROJECT_BRIEF",
  "PRD",
  "USER_FLOW",
  "TECHNICAL_SPEC",
  "TEST_PLAN",
  "TASKS",
  "AGENTS",
  "DESIGN_SPEC",
]);

export const versionOriginSchema = z.enum(["ai", "user", "import"]);

export const approvalStateSchema = z.enum(["draft", "reviewed", "approved"]);

export const createDocumentSchema = z
  .object({
    type: documentTypeSchema,
    title: z.string().min(1).max(200),
    contentMd: z.string().max(500000).default(""),
    upstreamManifest: z
      .object({ upstream: z.array(z.object({ documentId: z.string(), versionNo: z.number().int() })).max(20) })
      .optional(),
  })
  .strict();

export const createVersionSchema = z
  .object({
    contentMd: z.string().min(1).max(500000),
    origin: versionOriginSchema.default("user"),
    fromApproved: z.boolean().default(false),
  })
  .strict();

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type CreateVersionInput = z.infer<typeof createVersionSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;

export interface DocumentDto {
  id: string;
  projectId: string;
  type: DocumentType;
  title: string;
  approvalState: "draft" | "reviewed" | "approved";
  currentVersionId: string | null;
  currentVersionNo: number | null;
  contentMd: string | null;
  stale: boolean;
  approvedVersionId: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersionDto {
  id: string;
  documentId: string;
  versionNo: number;
  contentMd: string;
  origin: "ai" | "user" | "import";
  createdAt: string;
}
