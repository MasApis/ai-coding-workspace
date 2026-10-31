export interface Crumb {
  to: string;
  label: string;
}

const STATIC_LABELS: Record<string, string> = {
  projects: "Proyek",
  new: "Baru",
  planning: "Perencanaan",
  tasks: "Tugas",
  chat: "Chat AI",
  exports: "Ekspor",
  settings: "Pengaturan",
  design: "Desain",
  templates: "Templat",
  demo: "Demo",
};

const PROJECT_CHILD_LABELS: Record<string, string> = {
  planning: "Perencanaan",
  tasks: "Tugas",
  chat: "Chat AI",
  exports: "Ekspor",
  design: "Desain",
};

export function buildCrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ to: "/", label: "Ringkasan" }];
  if (pathname === "/") return crumbs;

  const segments = pathname.split("/").filter(Boolean);
  let acc = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] as string;
    acc += `/${seg}`;
    const prev = segments[i - 1];
    let label: string | undefined;
    if (i === 1 && prev === "projects") {
      label = seg === "new" ? STATIC_LABELS["new"] : "Detail proyek";
    } else if (i === 2 && segments[0] === "projects") {
      label = PROJECT_CHILD_LABELS[seg];
    } else if (i === 3 && segments[0] === "projects" && segments[2] === "chat") {
      label = "Percakapan";
    } else if (i === 3 && segments[0] === "projects" && segments[2] === "planning") {
      label = seg;
    } else {
      label = STATIC_LABELS[seg];
    }
    crumbs.push({ to: acc, label: label ?? seg });
  }
  return crumbs;
}
