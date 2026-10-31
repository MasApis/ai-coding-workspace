import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProvider,
  deleteProvider,
  friendlyProviderError,
  getGlobalPreference,
  listModels,
  listProviders,
  setGlobalPreference,
  testProvider,
  updateProvider,
} from "../src/lib/providers.js";

function mockFetchOnce(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
    ),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("providers client", () => {
  it("lists providers and models", async () => {
    mockFetchOnce({ data: { items: [{ id: "1" }] } });
    const items = await listProviders();
    expect(items).toHaveLength(1);

    mockFetchOnce({ data: { items: [{ id: "m" }], modelsAvailable: true } });
    const models = await listModels("1");
    expect(models).toEqual({ items: [{ id: "m" }], modelsAvailable: true });
  });

  it("creates with credential and updates without resending it", async () => {
    mockFetchOnce({ data: { id: "1", hasCredential: true } });
    await createProvider({ label: "R", protocol: "openai-compatible", baseUrl: "https://x.example/v1", credential: "sk-1" });
    expect(fetch).toHaveBeenCalledWith("/api/providers", expect.objectContaining({ method: "POST" }));

    mockFetchOnce({ data: { id: "1" } });
    await updateProvider("1", { label: "R2" });
    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).not.toHaveProperty("credential");
  });

  it("tests connections and manages the global default", async () => {
    mockFetchOnce({ data: { ok: true, message: "connected", modelsAvailable: true } });
    const result = await testProvider("1", "m");
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith("/api/providers/1/test", expect.objectContaining({ method: "POST" }));

    mockFetchOnce({ data: { providerId: "1", modelId: "m" } });
    const pref = await setGlobalPreference("1", "m");
    expect(pref.modelId).toBe("m");

    mockFetchOnce({ data: { providerId: "1", modelId: "m" } });
    expect((await getGlobalPreference())?.modelId).toBe("m");

    mockFetchOnce(null, 204);
    await deleteProvider("1");
    expect(fetch).toHaveBeenCalledWith("/api/providers/1", expect.objectContaining({ method: "DELETE" }));
  });

  it("maps error codes to understandable messages", () => {
    expect(friendlyProviderError("UNAUTHORIZED")).toContain("ditolak");
    expect(friendlyProviderError("UPSTREAM_TIMEOUT")).toContain("Waktu habis");
    expect(friendlyProviderError("NO_PROVIDER_CONFIGURED")).toContain("Belum ada");
    expect(friendlyProviderError("NETWORK_ERROR")).toContain("server lokal");
    expect(friendlyProviderError("SOMETHING_ELSE")).toContain("kesalahan");
  });
});
