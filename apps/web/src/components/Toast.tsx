import { useSyncExternalStore } from "react";

export interface ToastItem {
  id: number;
  message: string;
}

let nextId = 1;
let items: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function snapshot(): ToastItem[] {
  return items;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Introspection for tests and the Toaster; UI code should use toast().
export function subscribeToasts(listener: () => void): () => void {
  return subscribe(listener);
}

export function readToasts(): ToastItem[] {
  return snapshot();
}

// Success feedback for save/approve/preference actions. Errors keep using
// Alert next to the form that failed so the message stays in context.
export function toast(message: string, timeoutMs = 4000): number {
  const id = nextId++;
  items = [...items, { id, message }];
  emit();
  setTimeout(() => dismissToast(id), timeoutMs);
  return id;
}

export function dismissToast(id: number): void {
  if (!items.some((item) => item.id === id)) return;
  items = items.filter((item) => item.id !== id);
  emit();
}

export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, readToasts);
  if (toasts.length === 0) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className="pointer-events-auto flex min-h-11 max-w-md items-center gap-3 rounded-control bg-ink px-4 py-2 text-sm text-white shadow-lg"
        >
          <span>{item.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(item.id)}
            aria-label="Tutup notifikasi"
            className="rounded px-1 text-white/80 hover:text-white"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
