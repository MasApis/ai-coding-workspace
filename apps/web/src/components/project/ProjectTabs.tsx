import { Link, useLocation } from "react-router";

const TABS = [
  { path: "", label: "Ringkasan" },
  { path: "/documents", label: "Dokumen" },
  { path: "/design", label: "Desain" },
  { path: "/tasks", label: "Tugas" },
  { path: "/chat", label: "Chat" },
  { path: "/exports", label: "Ekspor" },
] as const;

export function ProjectTabs({ projectId }: { projectId: string }) {
  const { pathname } = useLocation();
  const base = `/projects/${projectId}`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";

  function isActive(path: string): boolean {
    if (path === "") return rest === "";
    // Planning is the working surface for documents, so it belongs to that tab.
    if (path === "/documents") return rest === "/documents" || rest.startsWith("/planning");
    return rest === path || rest.startsWith(`${path}/`);
  }

  return (
    <nav aria-label="Bagian proyek" className="-mx-4 mb-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {TABS.map((tab) => {
          const active = isActive(tab.path);
          return (
            <li key={tab.path}>
              <Link
                to={`${base}${tab.path}`}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-flex min-h-10 items-center border-b-2 px-3 text-sm ${
                  active ? "border-accent font-medium text-accent" : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
