import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConversation, listConversations, listMessages } from "../src/lib/chat.js";

function mockFetchOnce(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("chat client", () => {
  it("lists and creates conversations", async () => {
    mockFetchOnce({ data: { items: [{ id: "c1" }] } });
    expect(await listConversations("p1")).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith("/api/projects/p1/conversations", expect.anything());

    mockFetchOnce({ data: { id: "c2" } }, 201);
    await createConversation("p1", "Sesi");
    expect(fetch).toHaveBeenCalledWith("/api/projects/p1/conversations", expect.objectContaining({ method: "POST" }));
  });

  it("reads messages in order", async () => {
    mockFetchOnce({ data: { items: [{ role: "user" }, { role: "assistant" }] } });
    const items = await listMessages("c1");
    expect(items.map((m) => m.role)).toEqual(["user", "assistant"]);
  });
});
