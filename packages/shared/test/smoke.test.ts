import { describe, expect, it } from "vitest";
import { placeholder } from "../src/index.js";

describe("shared smoke", () => {
  it("exposes workspace placeholder", () => {
    expect(placeholder()).toBe("ai-coding-workspace");
  });
});
