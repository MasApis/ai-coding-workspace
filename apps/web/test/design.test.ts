import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateDesignStream, parseDesignSections } from "../src/lib/design.js";

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

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("design sections parser", () => {
  it("splits ## sections and keeps intro", () => {
    const parsed = parseDesignSections("# T\n\nIntro\n\n## Brief Desain\n\nIsi\n\n## Token Desain\n\nTok");
    expect(parsed.get("Brief Desain")).toBe("Isi");
    expect(parsed.get("Token Desain")).toBe("Tok");
    expect(parsed.get("Tidak Ada")).toBeUndefined();
  });

  it("returns empty for content without sections", () => {
    expect(parseDesignSections("# Hanya judul").size).toBe(0);
  });
});

describe("design client", () => {
  it("streams progress then completes", async () => {
    const chunks = [
      'data: {"type":"start"}\n\n',
      'data: {"type":"progress","section":"Brief Desain","done":1,"total":5}\n\n',
      'data: {"type":"complete","documentId":"d1","versionNo":2}\n\n',
    ];
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse(chunks)));
    const events: string[] = [];
    let done: { documentId?: string; versionNo?: number } | null = null;
    await generateDesignStream("p1", false, new AbortController().signal, {
      onProgress: (s) => events.push(s.section),
      onError: () => {},
      onDone: (d) => {
        done = d;
      },
    });
    expect(events).toEqual(["Brief Desain"]);
    expect(done).toEqual({ documentId: "d1", versionNo: 2 });
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ fromApproved: false });
  });

  it("surfaces error events", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sseResponse(['data: {"type":"error","code":"NEED_APPROVED_BASELINE","message":"butuh PRD"}\n\n'])),
    );
    let failure: { code: string; message: string } | null = null;
    await generateDesignStream("p1", true, new AbortController().signal, {
      onProgress: () => {},
      onError: (code, message) => {
        failure = { code, message };
      },
      onDone: () => {},
    });
    expect(failure).toEqual({ code: "NEED_APPROVED_BASELINE", message: "butuh PRD" });
  });
});
