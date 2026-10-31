import { z } from "zod";

export const generateDesignRequestSchema = z
  .object({ fromApproved: z.boolean().default(false) })
  .strict();

export type GenerateDesignRequest = z.infer<typeof generateDesignRequestSchema>;
