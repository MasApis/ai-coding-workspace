import { ApiError } from "./api.js";

export interface InstantiateInput {
  name: string;
  variables?: Record<string, string>;
  overwrite?: boolean;
}

export interface Instantiation {
  projectId: string;
  relativePath: string;
}

export async function instantiateTemplate(templateId: string, input: InstantiateInput): Promise<Instantiation> {
  let res: Response;
  try {
    res = await fetch(`/api/templates/${encodeURIComponent(templateId)}/instantiate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Tidak dapat menghubungi server lokal.");
  }
  const body = (await res.json()) as { data?: Instantiation; error?: { code: string; message: string } };
  if (!res.ok || body.error) {
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN_ERROR", body.error?.message ?? "Instansiasi gagal.");
  }
  return body.data as Instantiation;
}

export function downloadTemplateUrl(templateId: string): string {
  return `/api/templates/${encodeURIComponent(templateId)}/download`;
}

export function friendlyTemplateError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "TEMPLATE_TARGET_EXISTS") return "Target sudah ada. Centang timpa untuk mengganti, atau pakai nama lain.";
    if (err.code === "TEMPLATE_NOT_FOUND") return "Template tidak ditemukan.";
    if (err.code === "VALIDATION_ERROR") return "Isian belum valid. Periksa nama dan variabel.";
    return err.message;
  }
  return err instanceof Error ? err.message : "Terjadi kesalahan yang tidak dikenal.";
}
