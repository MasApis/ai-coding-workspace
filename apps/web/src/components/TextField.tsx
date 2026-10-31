import { useId, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, type InputHTMLAttributes } from "react";

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: string;
  children: (ids: { inputId: string; describedBy: string | undefined }) => ReactNode;
}

function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const describedBy = error ? errorId : hint ? hintId : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children({ inputId, describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL_CLASSES =
  "w-full rounded-control border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-soft aria-invalid:border-error";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

export function TextInput({ label, error, hint, ...rest }: InputProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ inputId, describedBy }) => (
        <input id={inputId} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={CONTROL_CLASSES} {...rest} />
      )}
    </FieldShell>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string };

export function TextArea({ label, error, hint, ...rest }: TextAreaProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ inputId, describedBy }) => (
        <textarea
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={CONTROL_CLASSES}
          rows={4}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string };

export function Select({ label, error, hint, children, ...rest }: SelectProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ inputId, describedBy }) => (
        <select id={inputId} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={CONTROL_CLASSES} {...rest}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}
