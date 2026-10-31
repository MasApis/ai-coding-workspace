import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, deleteProject, getProject, listProjects, updateProjectState } from "../src/lib/api.js";

function mockFetchOnce(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
    ),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("lists projects with state filter", async () => {
    mockFetchOnce({ data: { items: [] } });
    const items = await listProjects("archived");
    expect(items).toEqual([]);
    expect(fetch).toHaveBeenCalledWith("/api/projects?state=archived", expect.anything());
  });

  it("parses a single project", async () => {
    mockFetchOnce({ data: { id: "1", name: "A", slug: "a", state: "active" } });
    const project = await getProject("1");
    expect(project.slug).toBe("a");
  });

  it("throws ApiError carrying the server code", async () => {
    mockFetchOnce({ error: { code: "PROJECT_NOT_FOUND", message: "missing" } }, 404);
    const err = await getProject("nope").catch((e) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("PROJECT_NOT_FOUND");
    expect(err.status).toBe(404);
  });

  it("throws ApiError on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("down");
      }),
    );
    const err = await listProjects("active").catch((e) => e as ApiError);
    expect(err.code).toBe("NETWORK_ERROR");
  });

  it("archives and deletes via the right methods", async () => {
    mockFetchOnce({ data: { id: "1", state: "archived" } });
    await updateProjectState("1", "archived");
    expect(fetch).toHaveBeenCalledWith("/api/projects/1", expect.objectContaining({ method: "PATCH" }));

    mockFetchOnce(null, 204);
    await deleteProject("1");
    expect(fetch).toHaveBeenCalledWith("/api/projects/1", expect.objectContaining({ method: "DELETE" }));
  });
});
