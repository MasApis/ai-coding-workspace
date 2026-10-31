/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/lib/markdown.js";

describe("markdown rendering", () => {
  it("renders headings, lists, and code", () => {
    const html = renderMarkdown("# Judul\n\n- a\n- b\n\n`kode`");
    expect(html).toContain("<h1>");
    expect(html).toContain("<li>a</li>");
    expect(html).toContain("<code>kode</code>");
  });

  it("strips script tags and event handlers", () => {
    const html = renderMarkdown('Halo<script>alert(1)</script><img src="x" onerror="alert(1)">');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onerror");
    expect(html).toContain("Halo");
  });

  it("neutralizes javascript: links", () => {
    const html = renderMarkdown("[klik](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("keeps safe https links", () => {
    const html = renderMarkdown("[docs](https://example.com/x)");
    expect(html).toContain('href="https://example.com/x"');
  });
});
