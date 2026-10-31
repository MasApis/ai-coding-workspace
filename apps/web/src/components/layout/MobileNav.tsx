import { useEffect, useRef } from "react";
import { NavLink } from "react-router";

const NAV_ITEMS = [
  { to: "/", label: "Ringkasan", end: true },
  { to: "/projects", label: "Proyek", end: false },
  { to: "/templates", label: "Templat", end: false },
  { to: "/settings", label: "Pengaturan", end: false },
];

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileNav({ open, onClose, triggerRef }: { open: boolean; onClose: () => void; triggerRef: React.RefObject<HTMLButtonElement | null> }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (!open) {
      if (!firstRender.current) triggerRef.current?.focus();
      firstRender.current = false;
      return;
    }
    firstRender.current = false;
    closeRef.current?.focus();
  }, [open, triggerRef]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0] as HTMLElement;
      const last = items[items.length - 1] as HTMLElement;
      const active = document.activeElement;
      const outside = !panel.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigasi utama">
      <button type="button" aria-label="Tutup navigasi" onClick={onClose} className="absolute inset-0 cursor-default bg-ink/40" />
      <div ref={panelRef} className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-lg">
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <span className="text-sm font-bold">AI Coding Workspace</span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup navigasi"
            className="rounded-control px-2 text-ink-soft hover:bg-canvas hover:text-ink"
          >
            ✕
          </button>
        </div>
        <nav aria-label="Navigasi utama seluler" className="flex flex-col gap-1 p-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `rounded-control px-3 text-sm font-medium ${
                  isActive ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-canvas hover:text-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
