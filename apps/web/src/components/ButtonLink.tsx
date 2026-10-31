import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router";
import { buttonClasses, type ButtonVariant } from "./Button.js";

// Router navigation styled as a button. Never wrap a <button> in a <Link>:
// nested interactive elements break keyboard order and HTML validity.
export function ButtonLink({ variant = "primary", className = "", children, ...rest }: ComponentProps<typeof Link> & { variant?: ButtonVariant; children: ReactNode }) {
  return (
    <Link className={buttonClasses(variant, className)} {...rest}>
      {children}
    </Link>
  );
}
