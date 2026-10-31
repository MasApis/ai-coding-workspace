import { describe, expect, it } from "vitest";
import { routePaths } from "../src/app/routes.js";
import { buildCrumbs } from "../src/components/layout/breadcrumbs.js";

// Tech Spec v1.1 section 4 global routes (+ /demo kept from TICKET-003).
const EXPECTED_PATHS = [
  "/",
  "/projects",
  "/projects/new",
  "/projects/:projectId",
  "/projects/:projectId/documents",
  "/projects/:projectId/planning/:documentType",
  "/projects/:projectId/tasks",
  "/projects/:projectId/chat",
  "/projects/:projectId/chat/:conversationId",
  "/projects/:projectId/exports",
  "/projects/:projectId/design",
  "/templates",
  "/settings",
  "/demo",
  "*",
];

describe("route manifest", () => {
  it("covers every spec global route", () => {
    expect([...routePaths].sort()).toEqual([...EXPECTED_PATHS].sort());
  });
});

describe("buildCrumbs", () => {
  it("builds crumbs for a nested project page", () => {
    expect(buildCrumbs("/projects/abc/tasks")).toEqual([
      { to: "/", label: "Ringkasan" },
      { to: "/projects", label: "Proyek" },
      { to: "/projects/abc", label: "Detail proyek" },
      { to: "/projects/abc/tasks", label: "Tugas" },
    ]);
  });

  it("labels unknown project child segments without crashing", () => {
    const crumbs = buildCrumbs("/projects/abc/chat/xyz");
    expect(crumbs[crumbs.length - 1]).toEqual({ to: "/projects/abc/chat/xyz", label: "Percakapan" });
  });

  it("labels the documents tab", () => {
    expect(buildCrumbs("/projects/abc/documents")).toEqual([
      { to: "/", label: "Ringkasan" },
      { to: "/projects", label: "Proyek" },
      { to: "/projects/abc", label: "Detail proyek" },
      { to: "/projects/abc/documents", label: "Dokumen" },
    ]);
  });

  it("shows a readable label for the planning document", () => {
    expect(buildCrumbs("/projects/abc/planning/technical-spec")[4]).toEqual({
      to: "/projects/abc/planning/technical-spec",
      label: "Spesifikasi Teknis",
    });
  });

  it("handles root and top-level pages", () => {
    expect(buildCrumbs("/")).toEqual([{ to: "/", label: "Ringkasan" }]);
    expect(buildCrumbs("/settings")).toEqual([
      { to: "/", label: "Ringkasan" },
      { to: "/settings", label: "Pengaturan" },
    ]);
  });
});
