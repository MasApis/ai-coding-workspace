import { beforeEach, describe, expect, it, vi } from "vitest";
import { createExport } from "../src/lib/exports.js";

function mockFetchOnce(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("exports client", () => {
  it("creates exports with explicit drafts flag", async () => {
    mockFetchOnce({ data: { id: "e1" } }, 201);
    const dto = await createExport("p1", true);
    expect(dto.id).toBe("e1");
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/p1/exports",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ includeDrafts: true }) }),
    );
  });

  it("defaults to approved-only", async () => {
    mockFetchOnce({ data: { id: "e2" } }, 201);
    await createExport("p1");
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ includeDrafts: false });
  });
});
