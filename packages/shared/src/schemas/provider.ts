import { z } from "zod";

export const providerProtocolSchema = z.enum(["openai-compatible", "openai", "anthropic", "gemini", "ollama"]);

export type ProviderProtocol = z.infer<typeof providerProtocolSchema>;

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

// Config-time URL policy (ADR AI-001): https for remote, explicit
// loopback http exception, no credentials in URL. Runtime SSRF/DNS
// enforcement belongs to the gateway (AI-025).
export const baseUrlSchema = z
  .string()
  .max(2000)
  .refine(
    (raw) => {
      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        return false;
      }
      if (url.username !== "" || url.password !== "") return false;
      if (url.protocol === "https:") return true;
      if (url.protocol === "http:" && isLoopback(url.hostname)) return true;
      return false;
    },
    { message: "baseUrl must be https, or http only for loopback hosts" },
  );

export const createProviderSchema = z
  .object({
    label: z.string().min(1).max(120),
    protocol: providerProtocolSchema,
    baseUrl: baseUrlSchema.optional(),
    credential: z.string().min(1).max(10000).optional(),
    enabled: z.boolean().default(true),
  })
  .strict();

export const updateProviderSchema = z
  .object({
    label: z.string().min(1).max(120).optional(),
    baseUrl: baseUrlSchema.optional(),
    credential: z.string().min(1).max(10000).optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "empty update" });

export const updateModelsSchema = z
  .object({ models: z.array(z.string().min(1).max(200)).max(200) })
  .strict();

export const updatePreferencesSchema = z
  .object({
    providerId: z.string().min(1).max(200),
    modelId: z.string().min(1).max(200),
  })
  .strict();

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;

export interface ProviderDto {
  id: string;
  label: string;
  protocol: ProviderProtocol;
  baseUrl: string | null;
  enabled: boolean;
  hasCredential: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelPresetDto {
  id: string;
  providerId: string;
  modelId: string;
  label: string | null;
  enabled: boolean;
}

export interface AiPreferencesDto {
  providerId: string;
  modelId: string;
}
