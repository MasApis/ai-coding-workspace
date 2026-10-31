import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Alert } from "../components/Alert.js";
import { Skeleton } from "../components/Skeleton.js";
import { getProject } from "../lib/api.js";
import { BackToProjects, PageHeader } from "./PageBits.js";

const DOC_TYPES = [
  { slug: "project-brief", label: "Brief" },
  { slug: "prd", label: "PRD" },
  { slug: "user-flow", label: "Alur Pengguna" },
  { slug: "technical-spec", label: "Spesifikasi Teknis" },
  { slug: "test-plan", label: "Rencana Uji" },
  { slug: "tasks", label: "Dokumen Tugas" },
  { slug: "agents", label: "AGENTS" },
];

export function ProjectOverviewPage() {
  const { projectId } = useParams();
  const projectQuery = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId ?? ""), enabled: !!projectId });
  const project = projectQuery.data ?? null;

  return (
    <div>
      {projectQuery.isPending && <Skeleton label="Memuat proyek…" />}
      {projectQuery.isError && (
        <Alert variant="error" title="Proyek tidak dapat dimuat">
          Proyek mungkin sudah dihapus.
        </Alert>
      )}
      {!projectQuery.isPending && !projectQuery.isError && project && (
        <>
          <PageHeader title={project.name} description={project.description ?? `ID: ${project.id}`} />
          <ul className="flex flex-col gap-2">
            {DOC_TYPES.map((doc) => (
              <li key={doc.slug}>
                <Link to={`/projects/${projectId}/planning/${doc.slug}`} className="text-sm text-accent hover:underline">
                  {doc.label} →
                </Link>
              </li>
            ))}
            <li>
              <Link to={`/projects/${projectId}/tasks`} className="text-sm text-accent hover:underline">
                Tugas →
              </Link>
            </li>
            <li>
              <Link to={`/projects/${projectId}/chat`} className="text-sm text-accent hover:underline">
                Chat AI →
              </Link>
            </li>
            <li>
              <Link to={`/projects/${projectId}/exports`} className="text-sm text-accent hover:underline">
                Ekspor →
              </Link>
            </li>
          </ul>
        </>
      )}
      <div className="mt-6">
        <BackToProjects />
      </div>
    </div>
  );
}
