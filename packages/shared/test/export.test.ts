import { describe, expect, it } from "vitest";
import { createExportRequestSchema } from "../src/schemas/export.js";

describe("export schemas", () => {
  it("defaults to approved-only", () => {
    expect(createExportRequestSchema.parse({}).includeDrafts).toBe(false);
  });

  it("accepts an explicit drafts opt-in", () => {
    expect(createExportRequestSchema.parse({ includeDrafts: true }).includeDrafts).toBe(true);
  });
});
