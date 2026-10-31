import { Link, useParams } from "react-router";
import { BackToProjects, PageHeader } from "./PageBits.js";

const DOC_TYPES = [
  { slug: "brief", label: "Brief" },
  { slug: "prd", label: "PRD" },
  { slug: "user-flow", label: "Alur Pengguna" },
  { slug: "technical-spec", label: "Spesifikasi Teknis" },
  { slug: "test-plan", label: "Rencana Uji" },
  { slug: "tasks", label: "Tugas & AGENTS" },
];

export function ProjectOverviewPage() {
  const { projectId } = useParams();
  return (
    <div>
      <PageHeader title="Detail proyek" description={`ID: ${projectId}`} />
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
      <div className="mt-6">
        <BackToProjects />
      </div>
    </div>
  );
}
