import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./Button.js";

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  confirmLabel?: string;
  onConfirm?: () => void;
  destructive?: boolean;
  confirmDisabled?: boolean;
}

export function Dialog({ open, title, onClose, children, confirmLabel, onConfirm, destructive = false, confirmDisabled = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-modal border border-line bg-surface p-6 text-ink backdrop:bg-ink/40"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-3 text-sm">{children}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Batal
        </Button>
        {confirmLabel && (
          <Button variant={destructive ? "destructive" : "primary"} onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        )}
      </div>
    </dialog>
  );
}
