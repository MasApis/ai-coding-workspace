import { z } from "zod";
import type { DocumentType } from "./document.js";

export const projectStateSchema = z.enum(["active", "archived"]);

export const createProjectSchema = z
  .object({
    name: z.string().min(1).max(120),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    description: z.string().max(2000).optional(),
    ideaMd: z.string().max(20000).optional(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    ideaMd: z.string().max(20000).optional(),
    state: projectStateSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "empty update" });

export const projectListQuerySchema = z.object({
  state: z.enum(["active", "archived", "all"]).default("active"),
});

export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export interface ProjectDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ideaMd: string | null;
  state: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

// Canonical planning order. DESIGN_SPEC is generated from the PRD but is not a
// blocking step, so it never defines a project's stage.
export const PLANNING_STEP_TYPES = [
  "PROJECT_BRIEF",
  "PRD",
  "USER_FLOW",
  "TECHNICAL_SPEC",
  "TEST_PLAN",
  "TASKS",
  "AGENTS",
] as const satisfies readonly DocumentType[];

export type PlanningStepType = (typeof PLANNING_STEP_TYPES)[number];

export type ProjectStage = PlanningStepType | "ready";

export type ProjectNextActionKind =
  | "create-document"
  | "write-document"
  | "review-document"
  | "approve-document"
  | "refresh-document"
  | "export";

export interface ProjectNextAction {
  kind: ProjectNextActionKind;
  documentType: DocumentType | null;
}

// Derived, never stored: the API reports where the project actually stands so
// every screen can offer the same next step instead of guessing.
export interface ProjectSummaryDto {
  stage: ProjectStage;
  nextAction: ProjectNextAction;
  documents: { total: number; approved: number; stale: number };
  tasks: { total: number; done: number };
  lastExportAt: string | null;
}

export interface ProjectWithSummaryDto extends ProjectDto {
  summary: ProjectSummaryDto;
}
