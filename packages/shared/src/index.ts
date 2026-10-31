export const WORKSPACE_NAME = "ai-coding-workspace";

export function placeholder(): string {
  return WORKSPACE_NAME;
}

export * from "./schemas/project.js";
export * from "./schemas/provider.js";
export * from "./schemas/ai.js";
export * from "./schemas/document.js";
export * from "./schemas/plan.js";
export { z } from "zod";
