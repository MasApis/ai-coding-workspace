import { Link } from "react-router";
import { Button } from "../components/Button.js";
import { PageHeader } from "./PageBits.js";

export function OverviewPage() {
  return (
    <div>
      <PageHeader title="Ringkasan" description="Lanjutkan pekerjaan terakhir Anda." />
      <div className="rounded-card border border-line bg-surface p-6">
        <p className="text-sm text-ink-soft">Belum ada proyek. Daftar proyek adalah titik awal alur kerja.</p>
        <div className="mt-4">
          <Link to="/projects">
            <Button>Lihat proyek</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
