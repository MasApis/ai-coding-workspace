// Line helpers shared by the editor toolbar and the review diff. A single
// trailing newline is not a line: showing it would make every save look like
// it removed one line.
export function splitLines(text: string): string[] {
  if (text === "") return [];
  const withoutFinalNewline = text.endsWith("\n") ? text.slice(0, -1) : text;
  return withoutFinalNewline.split("\n");
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => token.length > 0).length;
}

export function countLines(text: string): number {
  return splitLines(text).length;
}
