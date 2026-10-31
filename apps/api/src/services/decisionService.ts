import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { CreateDecisionInput, DecisionDto } from "@workspace/shared";
import type { AppDatabase } from "../db/connection.js";
import { decisions } from "../db/schema.js";
import { getProject } from "./projectService.js";

function toDto(row: typeof decisions.$inferSelect): DecisionDto {
  return {
    id: row.id,
    projectId: row.projectId,
    question: row.question,
    answer: row.answer,
    rationale: row.rationale,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createDecision(db: AppDatabase, projectId: string, input: CreateDecisionInput): Promise<DecisionDto> {
  await getProject(db, projectId);
  const id = randomUUID();
  await db
    .insert(decisions)
    .values({ id, projectId, question: input.question, answer: input.answer, rationale: input.rationale ?? null })
    .run();
  const row = await db.select().from(decisions).where(eq(decisions.id, id)).get();
  if (!row) throw new Error("decision was not saved");
  return toDto(row);
}

export async function listDecisions(db: AppDatabase, projectId: string): Promise<DecisionDto[]> {
  await getProject(db, projectId);
  const rows = await db.select().from(decisions).where(eq(decisions.projectId, projectId)).orderBy(sql`rowid`).all();
  return rows.map(toDto);
}
