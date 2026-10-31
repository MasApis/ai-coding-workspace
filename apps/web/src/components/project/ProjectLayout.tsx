import { useQuery } from "@tanstack/react-query";
import { Outlet, useParams } from "react-router";
import type { ProjectWithSummaryDto } from "@workspace/shared";
import { Alert } from "../Alert.js";
import { Badge } from "../Badge.js";
import { ButtonLink } from "../ButtonLink.js";
import { Skeleton } from "../Skeleton.js";
import { getProject } from "../../lib/api.js";
import { nextActionHref, nextActionLabel, stageLabel, stageTone } from "../../lib/projectStage.js";
import { ProjectTabs } from "./ProjectTabs.js";

export interface ProjectOutletContext {
  project: ProjectWithSummaryDto;
}

export function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const projectQuery = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId ?? ""), enabled: !!projectId });

  if (!projectId) {
    return (
      <Alert variant="error" title="Proyek tidak dikenal">
        Kembali ke daftar proyek dan pilih salah satu.
      </Alert>
    );
  }

  if (projectQuery.isPending) return <Skeleton label="Memuat proyek…" />;

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <div className="flex flex-col gap-3">
        <Alert variant="error" title="Proyek tidak dapat dimuat">
          Proyek mungkin sudah dihapus.
        </Alert>
        <div>
          <ButtonLink to="/projects" variant="secondary">
            Kembali ke daftar proyek
          </ButtonLink>
        </div>
      </div>
    );
  }

  const project = projectQuery.data;
  const summary = project.summary;

  return (
    <div>
      <header className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl">{project.name}</h1>
            {project.description && <p className="mt-1 text-sm text-ink-soft">{project.description}</p>}
          </div>
          <ButtonLink to={nextActionHref(project.id, summary.nextAction)}>{nextActionLabel(summary.nextAction)}</ButtonLink>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={project.state === "active" ? "accent" : "neutral"}>{project.state === "active" ? "Aktif" : "Arsip"}</Badge>
          <Badge variant={stageTone(summary.stage, summary.documents.stale > 0)}>{stageLabel(summary.stage)}</Badge>
          {summary.documents.stale > 0 && <Badge variant="warning">{summary.documents.stale} dokumen usang</Badge>}
        </div>
      </header>

      <ProjectTabs projectId={project.id} />

      <Outlet context={{ project } satisfies ProjectOutletContext} />
    </div>
  );
}
