import { describe, expect, it } from "vitest";
import { createProviderSchema, updateModelsSchema, updatePreferencesSchema, updateProviderSchema } from "../src/schemas/provider.js";

describe("provider schemas", () => {
  it("accepts a loopback http endpoint", () => {
    const parsed = createProviderSchema.parse({
      label: "Lokal",
      protocol: "ollama",
      baseUrl: "http://127.0.0.1:11434",
    });
    expect(parsed.protocol).toBe("ollama");
  });

  it("accepts https remote endpoints", () => {
    const parsed = createProviderSchema.parse({
      label: "Router",
      protocol: "openai-compatible",
      baseUrl: "https://api.example.com/v1",
      credential: "sekret",
    });
    expect(parsed.baseUrl).toBe("https://api.example.com/v1");
  });

  it("rejects plain http for remote hosts", () => {
    expect(() =>
      createProviderSchema.parse({ label: "X", protocol: "openai-compatible", baseUrl: "http://api.example.com/v1" }),
    ).toThrow();
  });

  it("rejects credentials embedded in the URL", () => {
    expect(() =>
      createProviderSchema.parse({ label: "X", protocol: "openai-compatible", baseUrl: "https://user:pass@api.example.com" }),
    ).toThrow();
  });

  it("rejects unknown protocols and empty labels", () => {
    expect(() => createProviderSchema.parse({ label: "X", protocol: "smoke" })).toThrow();
    expect(() => createProviderSchema.parse({ label: "", protocol: "ollama" })).toThrow();
  });

  it("validates preferences and model lists", () => {
    expect(updatePreferencesSchema.parse({ providerId: "p1", modelId: "m1" }).modelId).toBe("m1");
    expect(() => updatePreferencesSchema.parse({ providerId: "p1", modelId: "" })).toThrow();
    expect(updateModelsSchema.parse({ models: ["a", "b"] }).models).toEqual(["a", "b"]);
    expect(() => updateProviderSchema.parse({})).toThrow();
    expect(updateProviderSchema.parse({ removeCredential: true }).removeCredential).toBe(true);
    expect(() => updateProviderSchema.parse({ credential: "x", removeCredential: true })).toThrow();
  });
});
