import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "destructive-ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-action text-white hover:bg-action-hover",
  secondary: "bg-surface text-ink border border-line hover:bg-canvas",
  ghost: "bg-transparent text-ink hover:bg-accent-soft",
  destructive: "bg-error text-white hover:brightness-110",
  // Destructive row actions stay quiet until hover: a solid red button next to
  // every row reads as an error state instead of an available action.
  "destructive-ghost": "bg-transparent text-error hover:bg-error/5",
};

// Shared so links that act as buttons (downloads, router navigation) keep the
// exact same shape, focus ring, touch target and states instead of copy-pasted
// classes. Anchors do not inherit the global `button` min-height.
export function buttonClasses(variant: ButtonVariant = "primary", className = ""): string {
  return `inline-flex min-h-10 items-center justify-center rounded-control px-4 text-sm font-medium transition-colors max-md:min-h-11 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`;
}

export function Button({ variant = "primary", children, className = "", type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, className)} {...rest}>
      {children}
    </button>
  );
}
