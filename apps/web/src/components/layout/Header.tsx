import { AIConnectionIndicator } from "./AIConnectionIndicator.js";
import { Breadcrumbs } from "./Breadcrumbs.js";

export function Header({ onOpenNav, menuButtonRef }: { onOpenNav: () => void; menuButtonRef: React.RefObject<HTMLButtonElement | null> }) {
  return (
    <header className="flex h-16 items-center gap-3 border-b border-line bg-surface px-4">
      <button
        ref={menuButtonRef}
        type="button"
        onClick={onOpenNav}
        aria-label="Buka navigasi"
        aria-haspopup="dialog"
        className="rounded-control px-2 text-ink md:hidden"
      >
        ☰
      </button>
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>
      <AIConnectionIndicator />
    </header>
  );
}
