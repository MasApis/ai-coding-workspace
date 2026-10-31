import { describe, expect, it } from "vitest";
import { generateStreamRequestSchema, questionsResponseSchema } from "../src/schemas/plan.js";

describe("plan schemas", () => {
  it("accepts a generation request for one document type", () => {
    const parsed = generateStreamRequestSchema.parse({ documentType: "PRD" });
    expect(parsed.documentType).toBe("PRD");
  });

  it("rejects unknown document types", () => {
    expect(() => generateStreamRequestSchema.parse({ documentType: "NOPE" })).toThrow();
  });

  it("validates a questions payload", () => {
    expect(questionsResponseSchema.parse({ questions: ["Untuk siapa?"] }).questions).toHaveLength(1);
    expect(() => questionsResponseSchema.parse({ questions: [] })).toThrow();
    expect(() => questionsResponseSchema.parse({ questions: ["a", "b", "c", "d", "e", "f", "g", "h", "i"] })).toThrow();
  });
});
