import { z } from "zod";

export const createExportRequestSchema = z
  .object({ includeDrafts: z.boolean().default(false) })
  .strict();

export type CreateExportInput = z.infer<typeof createExportRequestSchema>;

export const EXPORT_FILENAMES: Record<string, string> = {
  PROJECT_BRIEF: "PROJECT_BRIEF.md",
  PRD: "PRD.md",
  USER_FLOW: "USER_FLOW.md",
  TECHNICAL_SPEC: "TECHNICAL_SPEC.md",
  TEST_PLAN: "TEST_PLAN.md",
  TASKS: "TASKS.md",
  AGENTS: "AGENTS.md",
  DESIGN_SPEC: "DESIGN_SPEC.md",
};

export interface ExportManifestDoc {
  type: string;
  title: string;
  versionNo: number;
  status: "approved" | "draft" | "reviewed";
  sha256: string;
}

export interface ExportManifest {
  projectId: string;
  projectName: string;
  generatedAt: string;
  includeDrafts: boolean;
  docs: ExportManifestDoc[];
}

export interface ExportDto {
  id: string;
  projectId: string;
  manifestJson: string;
  relativeFilePath: string;
  createdAt: string;
}
