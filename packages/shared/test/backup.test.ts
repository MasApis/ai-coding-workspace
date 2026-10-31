import { describe, expect, it } from "vitest";
import { BACKUP_VERSION, backupFileSchema } from "../src/schemas/backup.js";

function validBackup() {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    project: { name: "P", slug: "p", description: null, ideaMd: null, state: "active" },
    documents: [
      {
        type: "PRD",
        title: "PRD",
        approvalState: "approved",
        upstreamManifest: null,
        versions: [{ versionNo: 1, contentMd: "# v1", origin: "user" as const }],
      },
    ],
    decisions: [],
    tasks: [],
    conversations: [
      {
        title: "T",
        messages: [{ role: "user" as const, contentMd: "hi", providerId: null, modelId: null, contextManifest: null }],
      },
    ],
    preferences: [{ modelId: "m", providerLabel: null as string | null }],
    designVersions: [],
  };
}

describe("backup schemas", () => {
  it("pins the current schema version", () => {
    expect(BACKUP_VERSION).toBe(1);
    expect(backupFileSchema.parse(validBackup()).schemaVersion).toBe(1);
  });

  it("rejects wrong versions and bad shapes", () => {
    expect(() => backupFileSchema.parse({ ...validBackup(), schemaVersion: 99 })).toThrow();
    expect(() => backupFileSchema.parse({ ...validBackup(), project: null })).toThrow();
    expect(() =>
      backupFileSchema.parse({ ...validBackup(), documents: [{ type: "NOPE", title: "x", approvalState: "draft", upstreamManifest: null, versions: [] }] }),
    ).toThrow();
  });
});
