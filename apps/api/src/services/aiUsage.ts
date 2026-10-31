import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { AppDatabase } from "../db/connection.js";
import { aiRequests } from "../db/schema.js";

export interface UsageRecord {
  projectId: string | null;
  providerId: string;
  modelId: string;
  status: "ok" | "error";
  errorCode?: string;
  startedAt: Date;
  inputTokens?: number;
  outputTokens?: number;
}

// Best-effort: usage recording must never break the AI response itself.
// Callers wrap this so a logging failure cannot fail the stream.
export async function recordAiRequest(db: AppDatabase, record: UsageRecord): Promise<void> {
  try {
    await db
      .insert(aiRequests)
      .values({
        id: randomUUID(),
        projectId: record.projectId,
        providerId: record.providerId,
        modelId: record.modelId,
        status: record.status,
        startedAt: record.startedAt,
        endedAt: new Date(),
        errorCode: record.errorCode ?? null,
        tokensIn: record.inputTokens ?? null,
        tokensOut: record.outputTokens ?? null,
      })
      .run();
  } catch {
    // Intentionally silent: usage insights are subordinate to responses.
  }
}

export interface UsageSummary {
  requests: number;
  errors: number;
  tokensIn: number;
  tokensOut: number;
}

export async function getUsageSummary(db: AppDatabase, projectId?: string): Promise<UsageSummary> {
  const selection = {
    status: aiRequests.status,
    tokensIn: aiRequests.tokensIn,
    tokensOut: aiRequests.tokensOut,
  };
  const rows =
    projectId === undefined
      ? await db.select(selection).from(aiRequests).all()
      : await db.select(selection).from(aiRequests).where(eq(aiRequests.projectId, projectId)).all();
  return rows.reduce<UsageSummary>(
    (acc, r) => ({
      requests: acc.requests + 1,
      errors: acc.errors + (r.status === "ok" ? 0 : 1),
      tokensIn: acc.tokensIn + (r.tokensIn ?? 0),
      tokensOut: acc.tokensOut + (r.tokensOut ?? 0),
    }),
    { requests: 0, errors: 0, tokensIn: 0, tokensOut: 0 },
  );
}
