import { describe, expect, it } from "vitest";
import { readSseEvents } from "../src/lib/sse.js";

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

describe("sse reader", () => {
  it("reassembles events split across chunks", async () => {
    const res = sseResponse(['data: {"type":"star', 't"}\n\ndata: {"type":"com', 'plete"}\n\n']);
    const events = [];
    for await (const e of readSseEvents(res)) events.push(e);
    expect(events).toEqual([{ type: "start" }, { type: "complete" }]);
  });

  it("ignores comments and blank lines", async () => {
    const res = sseResponse([": ping\n\n", 'data: {"type":"done"}\n\n']);
    const events = [];
    for await (const e of readSseEvents(res)) events.push(e);
    expect(events).toEqual([{ type: "done" }]);
  });

  it("stops at [DONE]", async () => {
    const res = sseResponse(['data: {"type":"a"}\n\ndata: [DONE]\n\ndata: {"type":"b"}\n\n']);
    const events = [];
    for await (const e of readSseEvents(res)) events.push(e);
    expect(events).toEqual([{ type: "a" }]);
  });
});
