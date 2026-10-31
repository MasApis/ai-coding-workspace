import { describe, expect, it } from "vitest";
import { STARTER_TEMPLATES, filterTemplates } from "../src/lib/templates/index.js";

describe("starter templates", () => {
  it("ships at least two ready starters with licenses and readmes", () => {
    expect(STARTER_TEMPLATES.length).toBeGreaterThanOrEqual(2);
    for (const t of STARTER_TEMPLATES) {
      expect(t.license.length).toBeGreaterThan(0);
      expect(t.files.length).toBeGreaterThan(0);
      expect(t.files.some((f) => f.path.toLowerCase() === "readme.md")).toBe(true);
    }
  });

  it("keeps every file path relative and traversal-free", () => {
    for (const t of STARTER_TEMPLATES) {
      for (const f of t.files) {
        expect(f.path.startsWith("/")).toBe(false);
        expect(f.path).not.toContain("..");
        expect(f.content.length).toBeGreaterThan(0);
      }
    }
  });

  it("filters by query and stack", () => {
    expect(filterTemplates(STARTER_TEMPLATES, "", "all")).toHaveLength(STARTER_TEMPLATES.length);
    const html = filterTemplates(STARTER_TEMPLATES, "", "HTML");
    expect(html.length).toBeGreaterThanOrEqual(1);
    expect(html.every((t) => t.stack === "HTML")).toBe(true);
    const found = filterTemplates(STARTER_TEMPLATES, "react", "all");
    expect(found.length).toBeGreaterThanOrEqual(1);
    expect(filterTemplates(STARTER_TEMPLATES, "cobol-tidak-ada", "all")).toHaveLength(0);
  });
});
