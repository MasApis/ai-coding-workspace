import { Link } from "react-router";
import { Alert } from "../components/Alert.js";
import { Button } from "../components/Button.js";
import { Skeleton } from "../components/Skeleton.js";
import { useProjects } from "../hooks/useProjects.js";
import { formatDateTime } from "../lib/format.js";
import { PageHeader } from "./PageBits.js";

export function OverviewPage() {
  const { data, isPending, isError, refetch } = useProjects("active");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <PageHeader title="Ringkasan" description="Lanjutkan pekerjaan terakhir Anda." />
        <Link to="/projects/new">
          <Button>Buat proyek baru</Button>
        </Link>
      </div>

      {isPending && <Skeleton label="Memuat proyek…" />}

      {isError && (
        <div className="flex flex-col gap-3">
          <Alert variant="error" title="Proyek tidak dapat dimuat">
            Pastikan server API lokal berjalan, lalu coba lagi.
          </Alert>
          <div>
            <Button variant="secondary" onClick={() => void refetch()}>
              Coba lagi
            </Button>
          </div>
        </div>
      )}

      {!isPending && !isError && data?.length === 0 && (
        <Alert variant="empty" title="Belum ada proyek aktif">
          Buat proyek pertama Anda untuk mulai merencanakan.
        </Alert>
      )}

      {!isPending && !isError && data && data.length > 0 && (
        <section aria-label="Lanjutkan" className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Lanjutkan</h2>
          <ul className="flex flex-col gap-2">
            {data.slice(0, 5).map((project) => (
              <li key={project.id} className="rounded-card border border-line bg-surface p-4">
                <Link to={`/projects/${project.id}`} className="font-medium text-accent hover:underline">
                  {project.name}
                </Link>
                <p className="mt-1 text-xs text-ink-soft">Diubah {formatDateTime(project.updatedAt)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-2">
            <Link to="/projects" className="text-sm text-accent hover:underline">
              Lihat semua proyek →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
