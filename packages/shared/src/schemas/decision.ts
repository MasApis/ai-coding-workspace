import { z } from "zod";

export const createDecisionSchema = z
  .object({
    question: z.string().min(1).max(500),
    answer: z.string().min(1).max(5000),
    rationale: z.string().max(2000).optional(),
  })
  .strict();

export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;

export interface DecisionDto {
  id: string;
  projectId: string;
  question: string;
  answer: string;
  rationale: string | null;
  createdAt: string;
}
