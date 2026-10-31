import { describe, expect, it } from "vitest";
import { chatStreamRequestSchema } from "../src/schemas/ai.js";

describe("ai schemas", () => {
  it("accepts a minimal chat stream request", () => {
    const parsed = chatStreamRequestSchema.parse({
      messages: [{ role: "user", content: "Halo" }],
    });
    expect(parsed.messages).toHaveLength(1);
  });

  it("rejects empty messages and bad roles", () => {
    expect(() => chatStreamRequestSchema.parse({ messages: [] })).toThrow();
    expect(() => chatStreamRequestSchema.parse({ messages: [{ role: "robot", content: "x" }] })).toThrow();
    expect(() => chatStreamRequestSchema.parse({ messages: [{ role: "user", content: "" }] })).toThrow();
  });

  it("bounds max output tokens", () => {
    expect(() => chatStreamRequestSchema.parse({ messages: [{ role: "user", content: "x" }], maxOutputTokens: 0 })).toThrow();
    expect(() => chatStreamRequestSchema.parse({ messages: [{ role: "user", content: "x" }], maxOutputTokens: 99999 })).toThrow();
  });
});
