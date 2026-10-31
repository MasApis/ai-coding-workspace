import { describe, expect, it } from "vitest";
import { PLANNING_STEP_TYPES, type ProjectNextAction } from "@workspace/shared";
import { slugToType, typeToSlug } from "../src/lib/documentTypes.js";
import { nextActionHref, nextActionLabel, stageLabel, stageTone } from "../src/lib/projectStage.js";

const PROJECT = "p1";

describe("stageLabel", () => {
  it("names the pending planning step", () => {
    expect(stageLabel("PROJECT_BRIEF")).toBe("Brief");
    expect(stageLabel("TECHNICAL_SPEC")).toBe("Spesifikasi Teknis");
  });

  it("reads as a state once every step is settled", () => {
    expect(stageLabel("ready")).toBe("Siap diekspor");
  });
});

describe("stageTone", () => {
  it("is green only when ready", () => {
    expect(stageTone("ready", false)).toBe("success");
    expect(stageTone("ready", true)).toBe("success");
  });

  it("warns when a document went stale", () => {
    expect(stageTone("PRD", true)).toBe("warning");
    expect(stageTone("PRD", false)).toBe("neutral");
  });
});

describe("nextActionLabel", () => {
  const cases: Array<[ProjectNextAction, string]> = [
    [{ kind: "create-document", documentType: "PROJECT_BRIEF" }, "Mulai Brief"],
    [{ kind: "write-document", documentType: "PRD" }, "Tulis PRD"],
    [{ kind: "review-document", documentType: "USER_FLOW" }, "Review Alur Pengguna"],
    [{ kind: "approve-document", documentType: "TEST_PLAN" }, "Setujui Rencana Uji"],
    [{ kind: "refresh-document", documentType: "TECHNICAL_SPEC" }, "Perbarui Spesifikasi Teknis"],
    [{ kind: "export", documentType: null }, "Ekspor paket ZIP"],
  ];

  it.each(cases)("labels %o", (action, label) => {
    expect(nextActionLabel(action)).toBe(label);
  });
});

describe("nextActionHref", () => {
  it("opens the planning page for a document step", () => {
    expect(nextActionHref(PROJECT, { kind: "approve-document", documentType: "TECHNICAL_SPEC" })).toBe(
      "/projects/p1/planning/technical-spec",
    );
  });

  it("opens exports once there is no document step left", () => {
    expect(nextActionHref(PROJECT, { kind: "export", documentType: null })).toBe("/projects/p1/exports");
  });
});

describe("document type slugs", () => {
  it("round-trips every planning step through its slug", () => {
    for (const type of PLANNING_STEP_TYPES) {
      expect(slugToType(typeToSlug(type))).toBe(type);
    }
  });

  it("rejects unknown slugs", () => {
    expect(slugToType("nope")).toBeNull();
    expect(slugToType(undefined)).toBeNull();
  });
});
