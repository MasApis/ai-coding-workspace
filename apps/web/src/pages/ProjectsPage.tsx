import { Alert } from "../components/Alert.js";
import { PageHeader, TicketNote } from "./PageBits.js";

export function ProjectsPage() {
  return (
    <div>
      <PageHeader title="Proyek" description="Semua workspace perencanaan Anda." />
      <div className="flex flex-col gap-4">
        <Alert variant="empty" title="Belum ada proyek">
          Daftar dan pencarian proyek hadir di TICKET-005; pembuatan proyek lewat wizard di TICKET-007.
        </Alert>
        <TicketNote ticket="TICKET-005">Antarmuka daftar, cari, arsip, dan hapus proyek.</TicketNote>
      </div>
    </div>
  );
}
