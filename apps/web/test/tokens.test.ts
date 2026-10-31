import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Read the source file directly (not through the Vite pipeline) so the
// test pins the exact tokens shipped in the stylesheet.
const css = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../src/styles/tokens.css"),
  "utf8",
);

// Design tokens must match docs/UI_UX_DESIGN_SPEC_AI_Coding_Workspace_v1.md section 3.
const REQUIRED_TOKENS: Array<[string, string]> = [
  ["canvas", "#F8FAFC"],
  ["surface", "#FFFFFF"],
  ["primary text", "#0F172A"],
  ["secondary text", "#64748B"],
  ["border", "#E2E8F0"],
  ["primary action", "#111827"],
  ["primary action hover", "#273244"],
  ["accent", "#4F46E5"],
  ["accent soft", "#EEF2FF"],
  ["success", "#15803D"],
  ["warning", "#B45309"],
  ["error", "#B91C1C"],
  ["focus ring", "#6366F1"],
];

function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const channel = (i: number): number => {
    const v = parseInt(c.substring(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Text pairs from the spec palette; WCAG 2.2 AA requires >= 4.5 for normal text.
const TEXT_PAIRS: Array<[string, string, string]> = [
  ["primary text on surface", "#0F172A", "#FFFFFF"],
  ["secondary text on surface", "#64748B", "#FFFFFF"],
  ["white on primary action", "#FFFFFF", "#111827"],
  ["white on accent", "#FFFFFF", "#4F46E5"],
  ["white on success", "#FFFFFF", "#15803D"],
  ["white on warning", "#FFFFFF", "#B45309"],
  ["white on error", "#FFFFFF", "#B91C1C"],
  ["accent on accent soft", "#4F46E5", "#EEF2FF"],
];

describe("design tokens", () => {
  it("contains every spec palette hex", () => {
    const lower = css.toLowerCase();
    for (const [name, hex] of REQUIRED_TOKENS) {
      expect(lower, `missing token ${name} (${hex})`).toContain(hex.toLowerCase());
    }
  });

  it("meets WCAG AA contrast for text pairs", () => {
    for (const [name, fg, bg] of TEXT_PAIRS) {
      expect(contrastRatio(fg, bg), `${name} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("meets 3:1 for the focus indicator on surface", () => {
    expect(contrastRatio("#6366F1", "#FFFFFF")).toBeGreaterThanOrEqual(3);
  });
});
