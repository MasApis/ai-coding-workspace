import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportBackup, importBackup } from "../src/lib/backup.js";

function mockFetchOnce(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("backup client", () => {
  it("exports backup json per project", async () => {
    mockFetchOnce({ schemaVersion: 1 });
    const data = await exportBackup("p1");
    expect(data.schemaVersion).toBe(1);
    expect(fetch).toHaveBeenCalledWith("/api/projects/p1/backup");
  });

  it("imports and returns the new project id", async () => {
    mockFetchOnce({ data: { projectId: "p2", projectSlug: "x", counts: {}, warnings: [] } }, 201);
    const result = await importBackup({ schemaVersion: 1 } as never);
    expect(result.projectId).toBe("p2");
    expect(fetch).toHaveBeenCalledWith("/api/projects/import", expect.objectContaining({ method: "POST" }));
  });
});
