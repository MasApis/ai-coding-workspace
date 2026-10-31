import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearFallback, getFallback, getUsage, setFallback } from "../src/lib/usage.js";

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

describe("usage and fallback client", () => {
  it("reads usage summaries", async () => {
    mockFetchOnce({ data: { requests: 3, errors: 1, tokensIn: 10, tokensOut: 20 } });
    const summary = await getUsage("p1");
    expect(summary.requests).toBe(3);
    expect(fetch).toHaveBeenCalledWith("/api/ai/usage?projectId=p1");
  });

  it("manages the global fallback", async () => {
    mockFetchOnce({ data: { providerId: "p", modelId: "m" } });
    const set = await setFallback("p", "m");
    expect(set.providerId).toBe("p");

    mockFetchOnce({ data: { providerId: "p", modelId: "m" } });
    const got = await getFallback();
    expect(got?.modelId).toBe("m");

    mockFetchOnce(null, 204);
    await clearFallback();
    expect(fetch).toHaveBeenCalledWith("/api/ai/fallback", expect.objectContaining({ method: "DELETE" }));
  });

  it("returns null when no fallback is configured", async () => {
    mockFetchOnce({ error: { code: "PREFERENCE_NOT_FOUND", message: "none" } }, 404);
    expect(await getFallback()).toBeNull();
  });
});
