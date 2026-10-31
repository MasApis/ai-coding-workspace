import { describe, expect, it } from "vitest";
import { createProjectSchema, updateProjectSchema } from "../src/schemas/project.js";

describe("project schemas", () => {
  it("accepts a minimal valid payload", () => {
    expect(createProjectSchema.parse({ name: "Todo" })).toEqual({ name: "Todo" });
  });

  it("rejects empty and overlong names", () => {
    expect(() => createProjectSchema.parse({ name: "" })).toThrow();
    expect(() => createProjectSchema.parse({ name: "x".repeat(121) })).toThrow();
  });

  it("rejects malformed slugs", () => {
    expect(() => createProjectSchema.parse({ name: "A", slug: "Bad Slug!" })).toThrow();
  });

  it("accepts partial updates with valid state", () => {
    expect(updateProjectSchema.parse({ state: "archived" })).toEqual({ state: "archived" });
    expect(() => updateProjectSchema.parse({ state: "deleted" })).toThrow();
    expect(() => updateProjectSchema.parse({})).toThrow();
  });
});
