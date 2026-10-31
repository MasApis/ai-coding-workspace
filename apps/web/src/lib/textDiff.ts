import { splitLines } from "./text.js";

export type DiffKind = "same" | "added" | "removed";

export interface DiffRow {
  kind: DiffKind;
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface DiffStats {
  added: number;
  removed: number;
}

// A review diff has to be truthful, not minimal. Common prefix/suffix trimming
// keeps the quadratic table small for typical edits; when the changed block is
// still huge we report it as one removed block followed by one added block
// instead of allocating an enormous table.
const DEFAULT_MAX_CELLS = 1_000_000;

function row(kind: DiffKind, text: string, oldLine: number | null, newLine: number | null): DiffRow {
  return { kind, text, oldLine, newLine };
}

function lcsRows(a: string[], b: string[], lineOffset: number): DiffRow[] {
  const n = a.length;
  const m = b.length;
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + (j + 1)]! + 1
          : Math.max(table[(i + 1) * width + j]!, table[i * width + (j + 1)]!);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push(row("same", a[i]!, lineOffset + i + 1, lineOffset + j + 1));
      i++;
      j++;
    } else if (table[(i + 1) * width + j]! >= table[i * width + (j + 1)]!) {
      rows.push(row("removed", a[i]!, lineOffset + i + 1, null));
      i++;
    } else {
      rows.push(row("added", b[j]!, null, lineOffset + j + 1));
      j++;
    }
  }
  while (i < n) {
    rows.push(row("removed", a[i]!, lineOffset + i + 1, null));
    i++;
  }
  while (j < m) {
    rows.push(row("added", b[j]!, null, lineOffset + j + 1));
    j++;
  }
  return rows;
}

export function diffLines(base: string, next: string, options: { maxCells?: number } = {}): DiffRow[] {
  const maxCells = options.maxCells ?? DEFAULT_MAX_CELLS;
  const a = splitLines(base);
  const b = splitLines(next);

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const rows: DiffRow[] = [];
  for (let i = 0; i < start; i++) rows.push(row("same", a[i]!, i + 1, i + 1));

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  if (midA.length * midB.length > maxCells) {
    midA.forEach((line, i) => rows.push(row("removed", line, start + i + 1, null)));
    midB.forEach((line, j) => rows.push(row("added", line, null, start + j + 1)));
  } else {
    rows.push(...lcsRows(midA, midB, start));
  }

  for (let i = 0; i < a.length - endA; i++) {
    rows.push(row("same", a[endA + i]!, endA + i + 1, endB + i + 1));
  }
  return rows;
}

export function diffStats(rows: DiffRow[]): DiffStats {
  return rows.reduce<DiffStats>(
    (stats, current) => {
      if (current.kind === "added") stats.added++;
      if (current.kind === "removed") stats.removed++;
      return stats;
    },
    { added: 0, removed: 0 },
  );
}

export function hasChanges(rows: DiffRow[]): boolean {
  return rows.some((current) => current.kind !== "same");
}
