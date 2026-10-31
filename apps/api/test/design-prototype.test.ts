import { describe, expect, it } from "vitest";
import { buildPrototypeHtml, escapeHtml, extractScreens, extractTokens } from "../src/services/design/prototype.js";

describe("prototype builder", () => {
  it("escapes hostile markup", () => {
    expect(escapeHtml('<script>alert(1)</script><img src=x onerror=y>')).not.toContain("<script>");
    expect(escapeHtml('<script>alert(1)</script><img src=x onerror=y>')).toContain("&lt;script&gt;");
    expect(escapeHtml('"a"&\'b\'')).toBe("&quot;a&quot;&amp;&#39;b&#39;");
  });

  it("extracts screens and tokens from sections", () => {
    const sections = new Map([
      ["Layar", "- Beranda: daftar\n- Detail: isi"],
      ["Token Desain", "- Primer: #111827\n- Radius: 8px"],
    ]);
    expect(extractScreens(sections)).toEqual(["Beranda: daftar", "Detail: isi"]);
    expect(extractTokens(sections).get("Primer")).toBe("#111827");
  });

  it("builds script-free HTML with escaped content", () => {
    const html = buildPrototypeHtml({
      projectName: 'P<ro>"jek',
      screens: ["Beranda<script>", "Detail"],
      tokens: new Map([["Primer", "#111827"]]),
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toMatch(/\son(click|error|load|mouseover|focus|submit|change|input|keydown)=/i);
    expect(html).toContain("Beranda&lt;script&gt;");
    expect(html).toContain("--primer: #111827");
  });
});
