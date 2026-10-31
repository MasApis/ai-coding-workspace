import { describe, expect, it } from "vitest";
import { createDocumentSchema, createVersionSchema } from "../src/schemas/document.js";

describe("document schemas", () => {
  it("accepts a valid document creation", () => {
    const parsed = createDocumentSchema.parse({ type: "PRD", title: "PRD", contentMd: "# awal" });
    expect(parsed.type).toBe("PRD");
  });

  it("rejects unknown types and empty titles", () => {
    expect(() => createDocumentSchema.parse({ type: "NOPE", title: "X" })).toThrow();
    expect(() => createDocumentSchema.parse({ type: "PRD", title: "" })).toThrow();
  });

  it("accepts versions with explicit from-approved flag", () => {
    expect(createVersionSchema.parse({ contentMd: "# v2" }).fromApproved).toBe(false);
    expect(createVersionSchema.parse({ contentMd: "# v2", fromApproved: true, origin: "ai" }).origin).toBe("ai");
    expect(() => createVersionSchema.parse({ contentMd: "" })).toThrow();
  });
});
