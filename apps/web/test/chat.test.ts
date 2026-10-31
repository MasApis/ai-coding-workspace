import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConversation, listConversations, listMessages, streamChatMessage } from "../src/lib/chat.js";

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

  it("sends context docs only when selected", async () => {
    const stream = `data: {"type":"complete","messageId":"m1"}\n\n`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } })),
    );
    const events: string[] = [];
    await streamChatMessage("c1", "Hai", undefined, [{ documentId: "d1", versionNo: 2 }], {
      signal: new AbortController().signal,
      onDelta: (t) => events.push(t),
      onError: () => {},
      onDone: () => {},
    });
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ contentMd: "Hai", contextDocs: [{ documentId: "d1", versionNo: 2 }] });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } })),
    );
    await streamChatMessage("c1", "Hai", undefined, [], {
      signal: new AbortController().signal,
      onDelta: () => {},
      onError: () => {},
      onDone: () => {},
    });
    const [, init2] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init2.body as string)).not.toHaveProperty("contextDocs");
  });
});
