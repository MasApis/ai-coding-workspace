import { describe, expect, it } from "vitest";
import { titleForPath } from "../src/hooks/useDocumentTitle.js";

describe("titleForPath", () => {
  it("names top-level screens", () => {
    expect(titleForPath("/")).toBe("Ringkasan · AI Coding Workspace");
    expect(titleForPath("/projects")).toBe("Proyek · AI Coding Workspace");
    expect(titleForPath("/projects/new")).toBe("Proyek baru · AI Coding Workspace");
    expect(titleForPath("/templates")).toBe("Templat · AI Coding Workspace");
    expect(titleForPath("/settings")).toBe("Pengaturan · AI Coding Workspace");
  });

  it("names project sections without needing loaded data", () => {
    expect(titleForPath("/projects/abc")).toBe("Detail proyek · AI Coding Workspace");
    expect(titleForPath("/projects/abc/documents")).toBe("Dokumen · AI Coding Workspace");
    expect(titleForPath("/projects/abc/planning/technical-spec")).toBe("Spesifikasi Teknis · AI Coding Workspace");
    expect(titleForPath("/projects/abc/chat/xyz")).toBe("Chat AI · AI Coding Workspace");
    expect(titleForPath("/projects/abc/exports")).toBe("Ekspor · AI Coding Workspace");
  });

  it("falls back to the app name for unknown paths", () => {
    expect(titleForPath("/tidak-ada")).toBe("AI Coding Workspace");
  });
});
