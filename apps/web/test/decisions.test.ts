import { beforeEach, describe, expect, it, vi } from "vitest";
import { listDecisions, saveDecision } from "../src/lib/decisions.js";

function mockFetchOnce(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("decisions client", () => {
  it("lists answers per project", async () => {
    mockFetchOnce({ data: { items: [{ question: "Q?", answer: "A" }] } });
    const items = await listDecisions("p1");
    expect(items).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith("/api/projects/p1/decisions", expect.anything());
  });

  it("saves an answer", async () => {
    mockFetchOnce({ data: { id: "d1" } }, 201);
    const saved = await saveDecision("p1", { question: "Q?", answer: "A" });
    expect(saved.id).toBe("d1");
    expect(fetch).toHaveBeenCalledWith(
      "/api/projects/p1/decisions",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ question: "Q?", answer: "A" }) }),
    );
  });
});
