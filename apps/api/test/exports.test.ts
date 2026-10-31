import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "exports-test-")), "test.sqlite");
}

let exportDir = "";

function zipBytes(relativeFilePath: string): Buffer {
  return readFileSync(join(exportDir, relativeFilePath));
}

async function loadZip(relativeFilePath: string): Promise<JSZip> {
  return JSZip.loadAsync(zipBytes(relativeFilePath));
}

describe("exports API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  let projectId: string;

  beforeEach(async () => {
    exportDir = mkdtempSync(join(tmpdir(), "exports-dir-"));
    process.env["EXPORT_DIR"] = exportDir;
    app = await createApp(tempDbPath(), { gatewayKey: randomBytes(32) });
    const project = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "Ship" } });
    projectId = project.json().data.id as string;
  });

  afterEach(async () => {
    await app.close();
    delete process.env["EXPORT_DIR"];
  });

  async function addDoc(type: string, content: string, approve: boolean): Promise<string> {
    const doc = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/documents`,
      payload: { type, title: type, contentMd: content },
    });
    const id = doc.json().data.id as string;
    if (approve) {
      await app.inject({ method: "POST", url: `/api/documents/${id}/review` });
      await app.inject({ method: "POST", url: `/api/documents/${id}/approve` });
    }
    return id;
  }

  it("exports approved-only by default with matching hashes", async () => {
    await addDoc("PRD", "# PRD final", true);
    await addDoc("TASKS", "# draft tasks", false);

    const res = await app.inject({ method: "POST", url: `/api/projects/${projectId}/exports`, payload: {} });
    expect(res.statusCode).toBe(201);
    const exportId = res.json().data.id as string;
    const relativeFilePath = res.json().data.relativeFilePath as string;

    const dl = await app.inject({ method: "GET", url: `/api/exports/${exportId}/download` });
    expect(dl.statusCode).toBe(200);
    expect(String(dl.headers["content-type"])).toContain("application/zip");

    const zip = await loadZip(relativeFilePath);
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(["PRD.md", "README.md", "manifest.json"]);
    expect(names).not.toContain("TASKS.md");

    const manifest = JSON.parse((await zip.files["manifest.json"]?.async("string")) ?? "{}") as {
      docs: Array<{ type: string; sha256: string }>;
    };
    expect(manifest.docs).toHaveLength(1);
    const prd = await zip.files["PRD.md"]?.async("nodebuffer");
    expect(createHash("sha256").update(prd ?? Buffer.alloc(0)).digest("hex")).toBe(manifest.docs[0]?.sha256);
  });

  it("includes drafts only on explicit opt-in", async () => {
    await addDoc("PRD", "# PRD final", true);
    await addDoc("TASKS", "# draft tasks", false);

    const res = await app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/exports`,
      payload: { includeDrafts: true },
    });
    const zip = await loadZip(res.json().data.relativeFilePath as string);
    expect(Object.keys(zip.files).sort()).toEqual(["PRD.md", "README.md", "TASKS.md", "manifest.json"]);
  });

  it("contains no provider secrets", async () => {
    const secret = `sk-export-probe-${randomBytes(4).toString("hex")}`;
    await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "R", protocol: "openai-compatible", baseUrl: "https://api.example.com/v1", credential: secret },
    });
    await addDoc("PRD", "# PRD final", true);

    const res = await app.inject({ method: "POST", url: `/api/projects/${projectId}/exports`, payload: { includeDrafts: true } });
    const zip = await loadZip(res.json().data.relativeFilePath as string);
    for (const name of Object.keys(zip.files)) {
      const text = await zip.files[name]?.async("string");
      expect(text).not.toContain(secret);
    }
  });

  it("produces identical content for identical input", async () => {
    await addDoc("PRD", "# PRD final", true);
    const first = await app.inject({ method: "POST", url: `/api/projects/${projectId}/exports`, payload: {} });
    const second = await app.inject({ method: "POST", url: `/api/projects/${projectId}/exports`, payload: {} });
    const zipA = await loadZip(first.json().data.relativeFilePath as string);
    const zipB = await loadZip(second.json().data.relativeFilePath as string);
    const namesA = Object.keys(zipA.files).sort();
    expect(namesA).toEqual(Object.keys(zipB.files).sort());
    for (const name of namesA) {
      if (name === "manifest.json") continue; // carries the generation timestamp
      const a = await zipA.files[name]?.async("nodebuffer");
      const b = await zipB.files[name]?.async("nodebuffer");
      expect(a?.equals(b ?? Buffer.alloc(0))).toBe(true);
    }
  });

  it("rejects unknown exports and projects", async () => {
    const missing = await app.inject({ method: "GET", url: "/api/exports/does-not-exist/download" });
    expect(missing.statusCode).toBe(404);

    const badProject = await app.inject({ method: "POST", url: "/api/projects/does-not-exist/exports", payload: {} });
    expect(badProject.statusCode).toBe(404);
  });
});
