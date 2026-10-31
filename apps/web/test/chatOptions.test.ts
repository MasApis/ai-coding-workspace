import { describe, expect, it } from "vitest";
import type { ProviderModelInfo } from "../src/lib/providers.js";
import { modelOptions, usesManualModelEntry } from "../src/lib/chatOptions.js";

function model(id: string, label?: string): ProviderModelInfo {
  return label === undefined ? { id } : { id, label };
}

describe("modelOptions", () => {
  it("starts with the resolved default and collapses duplicates", () => {
    const options = modelOptions([model("a", "Alpha"), model("a"), model("b")], "b");
    expect(options.map((o) => o.value)).toEqual(["", "a", "b"]);
    expect(options[0]?.label).toBe("Bawaan (b)");
    expect(options[1]?.label).toBe("Alpha — a");
  });

  it("drops entries without a usable id", () => {
    expect(modelOptions([model("")], "x").map((o) => o.value)).toEqual([""]);
  });

  it("only offers the default when the provider lists nothing", () => {
    expect(modelOptions([], "x").map((o) => o.value)).toEqual([""]);
  });
});

describe("usesManualModelEntry", () => {
  it("falls back to manual entry without a model list", () => {
    expect(usesManualModelEntry(false, 0)).toBe(true);
    expect(usesManualModelEntry(true, 0)).toBe(true);
    expect(usesManualModelEntry(true, 2)).toBe(false);
  });
});
