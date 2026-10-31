import { randomBytes } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "providers-test-")), "test.sqlite");
}

const SECRET = "sk-test-credential-value-12345";

describe("providers API", () => {
  let app: Awaited<ReturnType<typeof createApp>>;

  beforeEach(async () => {
    app = await createApp(tempDbPath(), { gatewayKey: randomBytes(32) });
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates a provider without ever returning the secret", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "Router", protocol: "openai-compatible", baseUrl: "https://api.example.com/v1", credential: SECRET },
    });
    expect(created.statusCode).toBe(201);
    const body = created.body;
    expect(body).not.toContain(SECRET);
    expect(created.json().data).toMatchObject({ label: "Router", hasCredential: true });

    const listed = await app.inject({ method: "GET", url: "/api/providers" });
    expect(listed.statusCode).toBe(200);
    expect(listed.body).not.toContain(SECRET);
    expect(listed.json().data.items).toHaveLength(1);
  });

  it("rejects invalid provider payloads", async () => {
    const http = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "X", protocol: "openai-compatible", baseUrl: "http://api.example.com/v1" },
    });
    expect(http.statusCode).toBe(422);

    const embedded = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "X", protocol: "openai-compatible", baseUrl: "https://u:p@api.example.com" },
    });
    expect(embedded.statusCode).toBe(422);

    const unknown = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "X", protocol: "nope" },
    });
    expect(unknown.statusCode).toBe(422);
  });

  it("removes credentials explicitly without ever returning them", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "R", protocol: "openai-compatible", baseUrl: "https://api.example.com/v1", credential: SECRET },
    });
    const id = created.json().data.id as string;
    expect(created.json().data.hasCredential).toBe(true);

    const removed = await app.inject({ method: "PATCH", url: `/api/providers/${id}`, payload: { removeCredential: true } });
    expect(removed.statusCode).toBe(200);
    expect(removed.json().data.hasCredential).toBe(false);
    expect(removed.body).not.toContain(SECRET);

    const listed = await app.inject({ method: "GET", url: "/api/providers" });
    expect(listed.body).not.toContain(SECRET);
  });

  it("rotates credentials and deletes cleanly with preference cleanup", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "Ollama", protocol: "ollama", baseUrl: "http://127.0.0.1:11434" },
    });
    const id = created.json().data.id as string;
    expect(created.json().data.hasCredential).toBe(false);

    const patched = await app.inject({ method: "PATCH", url: `/api/providers/${id}`, payload: { credential: SECRET } });
    expect(patched.statusCode).toBe(200);
    expect(patched.body).not.toContain(SECRET);
    expect(patched.json().data.hasCredential).toBe(true);

    const pref = await app.inject({
      method: "PUT",
      url: "/api/ai/preferences",
      payload: { providerId: id, modelId: "llama3" },
    });
    expect(pref.statusCode).toBe(200);

    const models = await app.inject({ method: "PUT", url: `/api/providers/${id}/models`, payload: { models: ["llama3"] } });
    expect(models.statusCode).toBe(200);
    expect(models.json().data.items).toHaveLength(1);

    const deleted = await app.inject({ method: "DELETE", url: `/api/providers/${id}` });
    expect(deleted.statusCode).toBe(204);

    const prefs = await app.inject({ method: "GET", url: "/api/ai/preferences" });
    expect(prefs.statusCode).toBe(404);
  });

  it("rejects preferences for unknown or disabled providers", async () => {
    const unknown = await app.inject({
      method: "PUT",
      url: "/api/ai/preferences",
      payload: { providerId: "nope", modelId: "m" },
    });
    expect(unknown.statusCode).toBe(404);

    const created = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "Off", protocol: "ollama", enabled: false },
    });
    const id = created.json().data.id as string;
    const disabled = await app.inject({
      method: "PUT",
      url: "/api/ai/preferences",
      payload: { providerId: id, modelId: "m" },
    });
    expect(disabled.statusCode).toBe(409);
    expect(disabled.json().error.code).toBe("PROVIDER_DISABLED");
  });

  it("supports project-scoped preferences validated against projects", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/providers",
      payload: { label: "P", protocol: "ollama" },
    });
    const providerId = created.json().data.id as string;

    const project = await app.inject({ method: "POST", url: "/api/projects", payload: { name: "AI Proj" } });
    const projectId = project.json().data.id as string;

    const put = await app.inject({
      method: "PUT",
      url: `/api/projects/${projectId}/ai-preferences`,
      payload: { providerId, modelId: "qwen" },
    });
    expect(put.statusCode).toBe(200);

    const get = await app.inject({ method: "GET", url: `/api/projects/${projectId}/ai-preferences` });
    expect(get.json().data).toMatchObject({ providerId, modelId: "qwen" });

    const missing = await app.inject({ method: "GET", url: "/api/projects/does-not-exist/ai-preferences" });
    expect(missing.statusCode).toBe(404);
  });
});
