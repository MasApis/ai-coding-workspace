import { describe, expect, it } from "vitest";
import { createConversationSchema, createMessageSchema } from "../src/schemas/conversation.js";

describe("conversation schemas", () => {
  it("accepts optional project linkage", () => {
    expect(createConversationSchema.parse({}).projectId).toBeUndefined();
    expect(createConversationSchema.parse({ projectId: "p1", title: "Tanya" }).title).toBe("Tanya");
  });

  it("validates messages and context manifests", () => {
    const parsed = createMessageSchema.parse({
      role: "user",
      contentMd: "Halo",
      contextManifest: { upstream: [{ documentId: "d1", versionNo: 2 }] },
    });
    expect(parsed.contextManifest?.upstream).toHaveLength(1);
    expect(() => createMessageSchema.parse({ role: "robot", contentMd: "x" })).toThrow();
    expect(() => createMessageSchema.parse({ role: "user", contentMd: "" })).toThrow();
    expect(() => createMessageSchema.parse({ role: "user", contentMd: "x", contextManifest: { upstream: [{ documentId: "d" }] } })).toThrow();
  });
});
