import { randomBytes } from "node:crypto";
import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "documents-test-")), "test.sqlite");
}

describe("documents API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let projectId: string;

  beforeEach(async () => {
    app = await createApp(tempDbPath(), { gatewayKey: randomBytes(32) });
    const project = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Docs" } });
    projectId = project.json().data.id as string;
  });

  afterEach(async () => {
    await app.close();
  });

  async function createDoc(type = "PRD", contentMd = "# v1") {
    return app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/documents`,
      payload: { type, title: type, contentMd },
    });
  }

  it("creates a document with version 1 in one transaction", async () => {
    const res = await createDoc();
    expect(res.statusCode).toBe(201);
    expect(res.json().data).toMatchObject({ type: "PRD", approvalState: "draft", currentVersionNo: 1, contentMd: "# v1" });

    const versions = await app.inject({ method: "GET", url: `/api/documents/${res.json().data.id}/versions` });
    expect(versions.json().data.items).toHaveLength(1);
  });

  it("rejects duplicate types and unknown projects", async () => {
    expect((await createDoc()).statusCode).toBe(201);
    const dup = await createDoc();
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error.code).toBe("DOCUMENT_TYPE_TAKEN");

    const missing = await app.inject({
      method: "POST",
      url: `/api/projects/${randomUUID()}/documents`,
      payload: { type: "PRD", title: "PRD" },
    });
    expect(missing.statusCode).toBe(404);
  });

  it("creates versions and resets review to draft", async () => {
    const doc = (await createDoc()).json().data as { id: string };
    await app.inject({ method: "POST", url: `/api/documents/${doc.id}/review` });

    const v2 = await app.inject({
      method: "POST",
      url: `/api/documents/${doc.id}/versions`,
      payload: { contentMd: "# v2" },
    });
    expect(v2.statusCode).toBe(201);
    expect(v2.json().data).toMatchObject({ currentVersionNo: 2, approvalState: "draft" });
  });

  it("locks approved content without the explicit flag", async () => {
    const doc = (await createDoc()).json().data as { id: string };
    await app.inject({ method: "POST", url: `/api/documents/${doc.id}/review` });
    const approved = await app.inject({ method: "POST", url: `/api/documents/${doc.id}/approve` });
    expect(approved.json().data.approvalState).toBe("approved");
    expect(approved.json().data.approvedVersionId).toBe(approved.json().data.currentVersionId);

    const blocked = await app.inject({
      method: "POST",
      url: `/api/documents/${doc.id}/versions`,
      payload: { contentMd: "# sneak" },
    });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe("APPROVED_LOCKED");

    const got = await app.inject({ method: "GET", url: `/api/documents/${doc.id}` });
    expect(got.json().data.contentMd).toBe("# v1");

    const reopened = await app.inject({
      method: "POST",
      url: `/api/documents/${doc.id}/versions`,
      payload: { contentMd: "# v2", fromApproved: true },
    });
    expect(reopened.json().data).toMatchObject({ currentVersionNo: 2, approvalState: "draft" });
  });

  it("rejects invalid state transitions", async () => {
    const doc = (await createDoc()).json().data as { id: string };
    const direct = await app.inject({ method: "POST", url: `/api/documents/${doc.id}/approve` });
    expect(direct.statusCode).toBe(200);
    expect(direct.json().data.approvalState).toBe("approved");

    const reReview = await app.inject({ method: "POST", url: `/api/documents/${doc.id}/review` });
    expect(reReview.statusCode).toBe(409);
    expect(reReview.json().error.code).toBe("INVALID_STATE");
  });

  it("flags downstream documents stale when upstream changes", async () => {
    const brief = (await createDoc("PROJECT_BRIEF", "# brief v1")).json().data as { id: string; currentVersionNo: number };
    const prd = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/documents`,
      payload: { type: "PRD", title: "PRD", contentMd: "# prd", upstreamManifest: { upstream: [{ documentId: brief.id, versionNo: 1 }] } },
    });
    const prdId = prd.json().data.id as string;

    let list = await app.inject({ method: "GET", url: `/api/projects/${projectId}/documents` });
    expect(list.json().data.items.find((d: { id: string }) => d.id === prdId).stale).toBe(false);

    await app.inject({ method: "POST", url: `/api/documents/${brief.id}/versions`, payload: { contentMd: "# brief v2" } });

    list = await app.inject({ method: "GET", url: `/api/projects/${projectId}/documents` });
    expect(list.json().data.items.find((d: { id: string }) => d.id === prdId).stale).toBe(true);
  });

  it("isolates documents per project", async () => {
    await createDoc();
    const other = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Other" } });
    const otherId = other.json().data.id as string;
    const list = await app.inject({ method: "GET", url: `/api/projects/${otherId}/documents` });
    expect(list.json().data.items).toHaveLength(0);
  });
});
