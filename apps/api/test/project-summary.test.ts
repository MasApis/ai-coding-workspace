import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { summarizeProject, type SummaryDocumentInput } from "../src/services/projectSummary.js";

function doc(overrides: Partial<SummaryDocumentInput> = {}): SummaryDocumentInput {
  return { type: "PROJECT_BRIEF", approvalState: "draft", hasContent: true, stale: false, ...overrides };
}

describe("summarizeProject", () => {
  it("starts at the brief when nothing exists", () => {
    const summary = summarizeProject({ documents: [], tasks: { total: 0, done: 0 }, lastExportAt: null });
    expect(summary.stage).toBe("PROJECT_BRIEF");
    expect(summary.nextAction).toEqual({ kind: "create-document", documentType: "PROJECT_BRIEF" });
    expect(summary.documents).toEqual({ total: 0, approved: 0, stale: 0 });
  });

  it("asks for content when the document is still empty", () => {
    const summary = summarizeProject({
      documents: [doc({ hasContent: false })],
      tasks: { total: 0, done: 0 },
      lastExportAt: null,
    });
    expect(summary.nextAction).toEqual({ kind: "write-document", documentType: "PROJECT_BRIEF" });
  });

  it("asks for review on a draft with content", () => {
    const summary = summarizeProject({ documents: [doc()], tasks: { total: 0, done: 0 }, lastExportAt: null });
    expect(summary.nextAction).toEqual({ kind: "review-document", documentType: "PROJECT_BRIEF" });
  });

  it("asks for approval on a reviewed document", () => {
    const summary = summarizeProject({
      documents: [doc({ approvalState: "reviewed" })],
      tasks: { total: 0, done: 0 },
      lastExportAt: null,
    });
    expect(summary.nextAction).toEqual({ kind: "approve-document", documentType: "PROJECT_BRIEF" });
  });

  it("moves to the next step once a document is approved", () => {
    const summary = summarizeProject({
      documents: [doc({ approvalState: "approved" })],
      tasks: { total: 0, done: 0 },
      lastExportAt: null,
    });
    expect(summary.stage).toBe("PRD");
    expect(summary.nextAction).toEqual({ kind: "create-document", documentType: "PRD" });
    expect(summary.documents.approved).toBe(1);
  });

  it("asks for a refresh when an approved document went stale", () => {
    const summary = summarizeProject({
      documents: [doc({ approvalState: "approved", stale: true })],
      tasks: { total: 0, done: 0 },
      lastExportAt: null,
    });
    expect(summary.stage).toBe("PROJECT_BRIEF");
    expect(summary.nextAction).toEqual({ kind: "refresh-document", documentType: "PROJECT_BRIEF" });
    expect(summary.documents.stale).toBe(1);
  });

  it("is ready to export only when every step is approved and current", () => {
    const documents = [
      doc({ type: "PROJECT_BRIEF", approvalState: "approved" }),
      doc({ type: "PRD", approvalState: "approved" }),
      doc({ type: "USER_FLOW", approvalState: "approved" }),
      doc({ type: "TECHNICAL_SPEC", approvalState: "approved" }),
      doc({ type: "TEST_PLAN", approvalState: "approved" }),
      doc({ type: "TASKS", approvalState: "approved" }),
      doc({ type: "AGENTS", approvalState: "approved" }),
    ];
    const summary = summarizeProject({ documents, tasks: { total: 4, done: 2 }, lastExportAt: "2026-10-31T10:00:00.000Z" });
    expect(summary.stage).toBe("ready");
    expect(summary.nextAction).toEqual({ kind: "export", documentType: null });
    expect(summary.tasks).toEqual({ total: 4, done: 2 });
    expect(summary.lastExportAt).toBe("2026-10-31T10:00:00.000Z");
  });

  it("ignores the design spec when deciding the stage", () => {
    const summary = summarizeProject({
      documents: [doc({ type: "DESIGN_SPEC", approvalState: "draft" })],
      tasks: { total: 0, done: 0 },
      lastExportAt: null,
    });
    expect(summary.stage).toBe("PROJECT_BRIEF");
  });
});

describe("project summary API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeEach(async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "summary-test-")), "test.sqlite");
    app = await createApp(dbPath);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createProject(name = "Ringkasan"): Promise<string> {
    const res = await app.inject({ method: "POST", url: "/api/projects", payload: { name } });
    return (res.json().data as { id: string }).id;
  }

  it("returns a summary on project detail", async () => {
    const id = await createProject();
    const res = await app.inject({ method: "GET", url: `/api/projects/${id}` });
    expect(res.statusCode).toBe(200);
    const summary = res.json().data.summary;
    expect(summary.stage).toBe("PROJECT_BRIEF");
    expect(summary.nextAction).toEqual({ kind: "create-document", documentType: "PROJECT_BRIEF" });
  });

  it("advances the stage after a document is approved", async () => {
    const id = await createProject();
    const created = await app.inject({
      method: "POST",
      url: `/api/projects/${id}/documents`,
      payload: { type: "PROJECT_BRIEF", title: "Brief", contentMd: "# Brief" },
    });
    expect(created.statusCode).toBe(201);
    const docId = created.json().data.id as string;

    const draftSummary = await app.inject({ method: "GET", url: `/api/projects/${id}` });
    expect(draftSummary.json().data.summary.nextAction).toEqual({ kind: "review-document", documentType: "PROJECT_BRIEF" });

    await app.inject({ method: "POST", url: `/api/documents/${docId}/approve` });

    const after = await app.inject({ method: "GET", url: `/api/projects/${id}` });
    expect(after.json().data.summary.stage).toBe("PRD");
    expect(after.json().data.summary.documents.approved).toBe(1);
  });

  it("includes the summary in the project list", async () => {
    const id = await createProject("Daftar");
    const res = await app.inject({ method: "GET", url: "/api/projects" });
    const items = res.json().data.items as Array<{ id: string; summary: { stage: string } }>;
    const item = items.find((entry) => entry.id === id);
    expect(item?.summary.stage).toBe("PROJECT_BRIEF");
  });
});
