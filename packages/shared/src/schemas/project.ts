import { z } from "zod";

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
