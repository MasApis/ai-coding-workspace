import { useRef, useState } from "react";
import { Outlet } from "react-router";
import { Header } from "./Header.js";
import { MobileNav } from "./MobileNav.js";
import { Sidebar } from "./Sidebar.js";
import { Toaster } from "../Toast.js";
import { useDocumentTitle } from "../../hooks/useDocumentTitle.js";

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useDocumentTitle();

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Lewati ke konten
      </a>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenNav={() => setNavOpen(true)} menuButtonRef={menuButtonRef} />
        <main id="konten" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          <Outlet />
        </main>
      </div>
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} triggerRef={menuButtonRef} />
      <Toaster />
    </div>
  );
}
