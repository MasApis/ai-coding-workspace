import { renderMarkdown } from "../lib/markdown.js";

// One typographic treatment for rendered markdown everywhere (document
// preview, design preview, chat replies) so the same content never looks like
// two different products. HTML is sanitized by renderMarkdown.
const PROSE_CLASSES =
  "max-w-none overflow-x-auto text-sm [&_code]:rounded [&_code]:bg-canvas [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_p]:my-2 [&_table]:w-full [&_td]:border [&_td]:border-line [&_td]:px-2 [&_th]:border [&_th]:border-line [&_th]:bg-canvas [&_th]:px-2 [&_ul]:my-2";

export function Markdown({ source, label, className = "" }: { source: string; label?: string; className?: string }) {
  return (
    <div
      aria-label={label}
      className={`${PROSE_CLASSES} ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  );
}
