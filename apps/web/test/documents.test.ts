import { beforeEach, describe, expect, it, vi } from "vitest";
import { approveDocument, createDocument, createVersion, listDocuments, listVersions, reviewDocument } from "../src/lib/documents.js";

function mockFetchOnce(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      status === 201 || status === 200
        ? new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
        : new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
    ),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("documents client", () => {
  it("lists and creates documents", async () => {
    mockFetchOnce({ data: { items: [] } });
    expect(await listDocuments("p1")).toEqual([]);
    expect(fetch).toHaveBeenCalledWith("/api/projects/p1/documents", expect.anything());

    mockFetchOnce({ data: { id: "d1" } }, 201);
    await createDocument("p1", { type: "PRD", title: "PRD", contentMd: "# awal" });
    expect(fetch).toHaveBeenCalledWith("/api/projects/p1/documents", expect.objectContaining({ method: "POST" }));
  });

  it("saves new versions and transitions state", async () => {
    mockFetchOnce({ data: { id: "d1" } }, 201);
    await createVersion("d1", { contentMd: "# v2" });
    expect(fetch).toHaveBeenCalledWith("/api/documents/d1/versions", expect.objectContaining({ method: "POST" }));

    mockFetchOnce({ data: { items: [] } });
    await listVersions("d1");

    mockFetchOnce({ data: {} });
    await reviewDocument("d1");

    mockFetchOnce({ data: {} });
    await approveDocument("d1");
    expect(fetch).toHaveBeenCalledWith("/api/documents/d1/approve", expect.objectContaining({ method: "POST" }));
  });
});
