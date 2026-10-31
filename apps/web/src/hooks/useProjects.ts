import { useQuery } from "@tanstack/react-query";
import { listProjects } from "../lib/api.js";

export type ProjectFilter = "active" | "archived" | "all";

export function useProjects(state: ProjectFilter = "active") {
  return useQuery({ queryKey: ["projects", state], queryFn: () => listProjects(state) });
}
