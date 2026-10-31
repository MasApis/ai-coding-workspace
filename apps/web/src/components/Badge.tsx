import type { ReactNode } from "react";

type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "error";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-canvas text-ink-soft border border-line",
  accent: "bg-accent-soft text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
};

export function Badge({ variant = "neutral", children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}>
      {children}
    </span>
  );
}
