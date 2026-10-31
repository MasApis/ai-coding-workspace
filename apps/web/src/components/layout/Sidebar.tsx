import { NavLink } from "react-router";

const NAV_ITEMS = [
  { to: "/", label: "Ringkasan", end: true },
  { to: "/projects", label: "Proyek", end: false },
  { to: "/templates", label: "Templat", end: false },
  { to: "/settings", label: "Pengaturan", end: false },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      aria-label="Navigasi utama"
      className={`hidden flex-col border-r border-line bg-surface md:flex ${collapsed ? "w-16" : "w-60"}`}
    >
      <div className="flex h-16 items-center justify-between border-b border-line px-4">
        {!collapsed && <span className="text-sm font-bold">AI Coding Workspace</span>}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Bentangkan sidebar" : "Ciutkan sidebar"}
          className="rounded-control px-2 text-ink-soft hover:bg-canvas hover:text-ink"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
      <nav className="flex flex-col gap-1 p-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            aria-label={item.label}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-control px-3 text-sm font-medium ${
                isActive ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-canvas hover:text-ink"
              } ${collapsed ? "justify-center" : ""}`
            }
          >
            {collapsed ? (
              <span aria-hidden="true">{item.label.charAt(0)}</span>
            ) : (
              <span>{item.label}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
