import { describe, expect, it } from "vitest";
import { createDecisionSchema } from "../src/schemas/decision.js";

describe("decision schemas", () => {
  it("accepts a question with an answer", () => {
    const parsed = createDecisionSchema.parse({ question: "Untuk siapa?", answer: "Siswa", rationale: "Pasar utama" });
    expect(parsed.answer).toBe("Siswa");
  });

  it("rejects empty questions or answers", () => {
    expect(() => createDecisionSchema.parse({ question: "", answer: "x" })).toThrow();
    expect(() => createDecisionSchema.parse({ question: "Q?", answer: "" })).toThrow();
  });
});
