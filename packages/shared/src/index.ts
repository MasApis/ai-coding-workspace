export const WORKSPACE_NAME = "ai-coding-workspace";

export function placeholder(): string {
  return WORKSPACE_NAME;
}

export * from "./schemas/project.js";
export * from "./schemas/provider.js";
export { z } from "zod";
