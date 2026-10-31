import { describe, expect, it } from "vitest";
import { generateDesignRequestSchema } from "../src/schemas/design.js";

describe("design schemas", () => {
  it("defaults fromApproved to false", () => {
    expect(generateDesignRequestSchema.parse({}).fromApproved).toBe(false);
  });

  it("accepts an explicit rebuild from approved", () => {
    expect(generateDesignRequestSchema.parse({ fromApproved: true }).fromApproved).toBe(true);
  });
});
