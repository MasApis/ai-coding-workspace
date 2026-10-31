import { describe, expect, it } from "vitest";
import type { AiPreferencesDto, ProviderDto } from "@workspace/shared";
import { describeAiStatus, isLoopbackUrl, providerReach } from "../src/lib/aiStatus.js";

function provider(overrides: Partial<ProviderDto> = {}): ProviderDto {
  return {
    id: "p1",
    label: "Groq",
    protocol: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    enabled: true,
    hasCredential: true,
    createdAt: "2026-10-31T00:00:00.000Z",
    updatedAt: "2026-10-31T00:00:00.000Z",
    ...overrides,
  };
}

const preference: AiPreferencesDto = { providerId: "p1", modelId: "openai/gpt-oss-120b" };

describe("isLoopbackUrl", () => {
  it("recognises loopback hosts only", () => {
    expect(isLoopbackUrl("http://127.0.0.1:11434")).toBe(true);
    expect(isLoopbackUrl("http://localhost:8080/v1")).toBe(true);
    expect(isLoopbackUrl("http://[::1]:11434")).toBe(true);
    expect(isLoopbackUrl("https://api.groq.com/openai/v1")).toBe(false);
    expect(isLoopbackUrl(null)).toBe(false);
    expect(isLoopbackUrl("not a url")).toBe(false);
  });
});

describe("providerReach", () => {
  it("treats ollama as local even behind a hostname", () => {
    expect(providerReach(provider({ protocol: "ollama", baseUrl: "http://box.local:11434" }))).toBe("local");
  });

  it("treats a loopback endpoint as local for any protocol", () => {
    expect(providerReach(provider({ protocol: "openai-compatible", baseUrl: "http://127.0.0.1:8080/v1" }))).toBe("local");
  });

  it("treats a remote endpoint as remote", () => {
    expect(providerReach(provider())).toBe("remote");
  });
});

describe("describeAiStatus", () => {
  it("reports unconfigured without a preference", () => {
    expect(describeAiStatus([provider()], null)).toEqual({ kind: "unconfigured", reach: null, providerLabel: null, modelId: null });
  });

  it("reports unconfigured when the preferred provider is disabled", () => {
    expect(describeAiStatus([provider({ enabled: false })], preference).kind).toBe("unconfigured");
  });

  it("reports unconfigured when the preferred provider was deleted", () => {
    expect(describeAiStatus([], preference).kind).toBe("unconfigured");
  });

  it("reports the provider label, model and reach when ready", () => {
    expect(describeAiStatus([provider()], preference)).toEqual({
      kind: "ready",
      reach: "remote",
      providerLabel: "Groq",
      modelId: "openai/gpt-oss-120b",
    });
  });

  it("reports local reach for a loopback provider", () => {
    const local = provider({ id: "p2", label: "Ollama", protocol: "ollama", baseUrl: "http://127.0.0.1:11434" });
    expect(describeAiStatus([local], { providerId: "p2", modelId: "llama3" })).toMatchObject({ kind: "ready", reach: "local" });
  });
});
