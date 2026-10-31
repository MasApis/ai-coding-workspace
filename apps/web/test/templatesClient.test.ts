import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadTemplateUrl, instantiateTemplate } from "../src/lib/templatesClient.js";

function mockFetchOnce(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("templates client", () => {
  it("instantiates with variables and overwrite flag", async () => {
    mockFetchOnce({ data: { projectId: "p1", relativePath: "templates/x/" } }, 201);
    const result = await instantiateTemplate("static-html", { name: "X", variables: { APP_NAME: "X" }, overwrite: true });
    expect(result.projectId).toBe("p1");
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ name: "X", variables: { APP_NAME: "X" }, overwrite: true });
  });

  it("builds download urls", async () => {
    expect(downloadTemplateUrl("react-vite")).toBe("/api/templates/react-vite/download");
  });
});
