import { describe, expect, it } from "vitest";
import { buildDescription, canProceed, type WizardDraft } from "../src/lib/wizard.js";

describe("wizard helpers", () => {
  it("blocks step 1 without a name", () => {
    expect(canProceed(0, { name: "", idea: "" })).toBe(false);
    expect(canProceed(0, { name: "Todo", idea: "" })).toBe(true);
  });

  it("always allows skipping optional steps", () => {
    const draft: WizardDraft = { name: "Todo", idea: "" };
    expect(canProceed(1, draft)).toBe(true);
    expect(canProceed(2, draft)).toBe(true);
    expect(canProceed(3, draft)).toBe(true);
  });

  it("omits empty sections from the description", () => {
    expect(buildDescription({ name: "Todo", idea: "Belajar", audience: "", constraints: "" })).toBe("Belajar");
    expect(buildDescription({ name: "Todo", idea: "", audience: "", constraints: "" })).toBeUndefined();
  });

  it("combines filled sections with headings", () => {
    const desc = buildDescription({ name: "Todo", idea: "Belajar CRUD", audience: "Siswa", constraints: "Offline" });
    expect(desc).toContain("Belajar CRUD");
    expect(desc).toContain("Pengguna: Siswa");
    expect(desc).toContain("Stack/Batasan: Offline");
  });
});
