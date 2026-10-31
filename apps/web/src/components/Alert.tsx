import type { ReactNode } from "react";

type AlertVariant = "error" | "info" | "empty";

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error: "border-error/30 bg-error/5 text-ink",
  info: "border-line bg-surface text-ink",
  empty: "border-dashed border-line bg-surface text-ink-soft",
};

export function Alert({ variant = "info", title, children }: { variant?: AlertVariant; title: string; children?: ReactNode }) {
  return (
    <div role={variant === "error" ? "alert" : "status"} className={`rounded-card border p-4 ${VARIANT_CLASSES[variant]}`}>
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  );
}
