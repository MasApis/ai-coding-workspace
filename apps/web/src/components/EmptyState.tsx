import type { ReactNode } from "react";

// Empty states explain the next useful action; Alert is reserved for errors
// and information. Pass the action (link or button) as children.
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="status" className="rounded-card border border-dashed border-line bg-surface p-4 text-ink-soft">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  );
}
