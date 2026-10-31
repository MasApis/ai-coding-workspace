import { describe, expect, it } from "vitest";
import { diffLines, diffStats, hasChanges } from "../src/lib/textDiff.js";
import { countLines, countWords, splitLines } from "../src/lib/text.js";

describe("splitLines", () => {
  it("returns no lines for empty text", () => {
    expect(splitLines("")).toEqual([]);
  });

  it("ignores a single trailing newline", () => {
    expect(splitLines("a\nb\n")).toEqual(["a", "b"]);
  });
});

describe("countWords", () => {
  it("counts whitespace-separated tokens", () => {
    expect(countWords("# Judul\n\ndua kata")).toBe(4);
  });
});

describe("countLines", () => {
  it("counts lines without the trailing newline", () => {
    expect(countLines("a\nb\n")).toBe(2);
    expect(countLines("")).toBe(0);
  });
});

describe("diffLines", () => {
  it("reports same rows for identical text", () => {
    const rows = diffLines("a\nb", "a\nb");
    expect(hasChanges(rows)).toBe(false);
    expect(rows.every((row) => row.kind === "same")).toBe(true);
  });

  it("reports added and removed lines", () => {
    const rows = diffLines("a\nb", "a\nc");
    expect(hasChanges(rows)).toBe(true);
    expect(diffStats(rows)).toEqual({ added: 1, removed: 1 });
    expect(rows[0]).toMatchObject({ kind: "same", text: "a" });
  });

  it("treats empty base as all added", () => {
    const rows = diffLines("", "satu\ndua");
    expect(rows.every((row) => row.kind === "added")).toBe(true);
    expect(diffStats(rows)).toEqual({ added: 2, removed: 0 });
  });

  it("never allocates a huge table on large rewrites", () => {
    const base = Array.from({ length: 500 }, (_, i) => `lama-${i}`).join("\n");
    const next = Array.from({ length: 500 }, (_, i) => `baru-${i}`).join("\n");
    const rows = diffLines(base, next, { maxCells: 100 });
    expect(rows).toHaveLength(1000);
    expect(diffStats(rows)).toEqual({ added: 500, removed: 500 });
  });
});
