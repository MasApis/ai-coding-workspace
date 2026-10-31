import { useEffect } from "react";
import { useLocation } from "react-router";
import { DOCUMENT_LABELS, slugToType } from "../lib/documentTypes.js";

const APP_SUFFIX = "AI Coding Workspace";

function sectionTitle(rest: string): string | null {
  if (rest === "" || rest === "/") return null;
  if (rest === "/documents") return "Dokumen";
  if (rest.startsWith("/documents")) return "Dokumen";
  if (rest.startsWith("/planning/")) {
    const type = slugToType(rest.split("/")[2]);
    return type ? DOCUMENT_LABELS[type] : "Perencanaan";
  }
  if (rest.startsWith("/tasks")) return "Tugas";
  if (rest.startsWith("/chat")) return "Chat AI";
  if (rest.startsWith("/exports")) return "Ekspor";
  if (rest.startsWith("/design")) return "Desain";
  return null;
}

// Every route sets a document title so tabs, history and screen readers name
// the current screen. Project names are not included: the layout header
// already shows them and titles must work before data loads.
export function titleForPath(pathname: string): string {
  if (pathname === "/") return `Ringkasan · ${APP_SUFFIX}`;
  if (pathname === "/projects") return `Proyek · ${APP_SUFFIX}`;
  if (pathname === "/projects/new") return `Proyek baru · ${APP_SUFFIX}`;
  if (pathname === "/templates") return `Templat · ${APP_SUFFIX}`;
  if (pathname === "/settings") return `Pengaturan · ${APP_SUFFIX}`;
  const projectMatch = pathname.match(/^\/projects\/[^/]+(.*)$/);
  if (projectMatch) {
    const section = sectionTitle(projectMatch[1] ?? "");
    return section ? `${section} · ${APP_SUFFIX}` : `Detail proyek · ${APP_SUFFIX}`;
  }
  return APP_SUFFIX;
}

export function useDocumentTitle(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = titleForPath(pathname);
  }, [pathname]);
}
