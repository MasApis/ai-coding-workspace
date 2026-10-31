import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button.js";

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  confirmLabel?: string;
  onConfirm?: () => void;
  destructive?: boolean;
}

export function Dialog({ open, title, onClose, children, confirmLabel, onConfirm, destructive = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open ]);

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
      aria-labelledby="dialog-title"
      className="w-full max-w-md rounded-modal border border-line bg-surface p-6 text-ink backdrop:bg-ink/40"
    >
      <h2 id="dialog-title" className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-3 text-sm">{children}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Batal
        </Button>
        {confirmLabel && (
          <Button variant={destructive ? "destructive" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        )}
      </div>
    </dialog>
  );
}
