import { HTML_STARTER } from "./html-starter.js";
import { REACT_STARTER } from "./react-starter.js";
import type { StarterTemplate } from "./types.js";

export type { StarterFile, StarterTemplate } from "./types.js";

export const STARTER_TEMPLATES: StarterTemplate[] = [HTML_STARTER, REACT_STARTER];

export type StackFilter = "all" | StarterTemplate["stack"];

export function filterTemplates(templates: StarterTemplate[], query: string, stack: StackFilter): StarterTemplate[] {
  const q = query.trim().toLowerCase();
  return templates.filter((t) => {
    if (stack !== "all" && t.stack !== stack) return false;
    if (!q) return true;
    return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.stack.toLowerCase().includes(q);
  });
}
