import { useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ProjectDto } from "@workspace/shared";
import { Alert } from "../components/Alert.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { Skeleton } from "../components/Skeleton.js";
import { Select, TextInput } from "../components/TextField.js";
import { useProjects, type ProjectFilter } from "../hooks/useProjects.js";
import { ApiError, deleteProject, filterProjects, updateProjectState } from "../lib/api.js";
import { formatDateTime } from "../lib/format.js";
import { PageHeader } from "./PageBits.js";

const ERROR_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: "Tidak dapat menghubungi server lokal. Pastikan API berjalan.",
  PROJECT_HAS_CONTENT: "Proyek masih memiliki dokumen atau tugas, jadi tidak dapat dihapus.",
  PROJECT_NOT_FOUND: "Proyek tidak ditemukan. Mungkin sudah dihapus.",
};

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) return ERROR_MESSAGES[err.code] ?? err.message;
  return "Terjadi kesalahan yang tidak dikenal.";
}

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ProjectFilter>("active");
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ProjectDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data, isPending, isError, refetch } = useProjects(filter);

  const visible = data ? filterProjects(data, search) : [];

  async function refresh(): Promise<void> {
    setActionError(null);
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  async function handleArchive(project: ProjectDto): Promise<void> {
    setActionError(null);
    try {
      await updateProjectState(project.id, project.state === "active" ? "archived" : "active");
      await refresh();
    } catch (err) {
      setActionError(friendlyError(err));
    }
  }

  async function handleDelete(): Promise<void> {
    if (!pendingDelete) return;
    setActionError(null);
    try {
      await deleteProject(pendingDelete.id);
      setPendingDelete(null);
      await refresh();
    } catch (err) {
      setPendingDelete(null);
      setActionError(friendlyError(err));
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Proyek" description="Semua workspace perencanaan Anda." />
        <Link to="/projects/new">
          <Button>Buat proyek baru</Button>
        </Link>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <TextInput label="Cari proyek" placeholder="Nama atau slug…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select label="Status" value={filter} onChange={(e) => setFilter(e.target.value as ProjectFilter)}>
          <option value="active">Aktif</option>
          <option value="archived">Arsip</option>
          <option value="all">Semua</option>
        </Select>
      </div>

      {actionError && (
        <div className="mb-4">
          <Alert variant="error" title="Aksi gagal">
            {actionError}
          </Alert>
        </div>
      )}

      {isPending && <Skeleton label="Memuat proyek…" />}

      {isError && (
        <div className="flex flex-col gap-3">
          <Alert variant="error" title="Daftar proyek tidak dapat dimuat">
            Pastikan server API lokal berjalan, lalu coba lagi.
          </Alert>
          <div>
            <Button variant="secondary" onClick={() => void refetch()}>
              Coba lagi
            </Button>
          </div>
        </div>
      )}

      {!isPending && !isError && visible.length === 0 && (
        <Alert variant="empty" title={data?.length === 0 ? "Belum ada proyek" : "Tidak ada hasil"}>
          {data?.length === 0 ? "Buat proyek pertama Anda untuk mulai merencanakan." : "Ubah kata kunci atau filter status."}
        </Alert>
      )}

      {!isPending && !isError && visible.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label={`Daftar proyek (${visible.length})`}>
          {visible.map((project) => (
            <li key={project.id} className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-4">
              <div className="min-w-0 flex-1">
                <Link to={`/projects/${project.id}`} className="font-medium text-accent hover:underline">
                  {project.name}
                </Link>
                <p className="mt-1 text-xs text-ink-soft">
                  {project.slug} · Diubah {formatDateTime(project.updatedAt)}
                </p>
              </div>
              <Badge variant={project.state === "active" ? "accent" : "neutral"}>
                {project.state === "active" ? "Aktif" : "Arsip"}
              </Badge>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => void handleArchive(project)}>
                  {project.state === "active" ? "Arsipkan" : "Kembalikan"}
                </Button>
                <Button variant="destructive" onClick={() => setPendingDelete(project)}>
                  Hapus
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={pendingDelete !== null}
        title="Hapus proyek?"
        onClose={() => setPendingDelete(null)}
        confirmLabel="Ya, hapus"
        destructive
        onConfirm={() => void handleDelete()}
      >
        <p>
          Proyek “{pendingDelete?.name}” akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
        </p>
      </Dialog>
    </div>
  );
}
