import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({ breaks: true });

export function renderMarkdown(markdown: string): string {
  const raw = marked.parse(markdown, { async: false }) as string;
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}
