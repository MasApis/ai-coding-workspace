import type { ProjectDto } from "@workspace/shared";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Tidak dapat menghubungi server lokal.");
  }
  if (res.status === 204) return undefined as T;
  const body = (await res.json()) as { data?: T; error?: { code: string; message: string } };
  if (!res.ok || body.error) {
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN_ERROR", body.error?.message ?? "Terjadi kesalahan.");
  }
  return body.data as T;
}

export function listProjects(state: "active" | "archived" | "all" = "active"): Promise<ProjectDto[]> {
  return request<{ items: ProjectDto[] }>(`/projects?state=${state}`).then((d) => d.items);
}

export function getProject(id: string): Promise<ProjectDto> {
  return request<ProjectDto>(`/projects/${encodeURIComponent(id)}`);
}

export function updateProjectState(id: string, state: "active" | "archived"): Promise<ProjectDto> {
  return request<ProjectDto>(`/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ state }),
  });
}

export function deleteProject(id: string): Promise<void> {
  return request<void>(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function filterProjects(projects: ProjectDto[], query: string): ProjectDto[] {
  const q = query.trim().toLowerCase();
  if (!q) return projects;
  return projects.filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
}
