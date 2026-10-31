import { PageHeader, TicketNote } from "./PageBits.js";

export function SettingsPage() {
  return (
    <div>
      <PageHeader title="Pengaturan" description="Provider AI, penyimpanan, dan keamanan." />
      <div className="flex flex-col gap-4">
        <TicketNote ticket="AI-026">Tambah/ubah/hapus/test koneksi provider AI, ID model manual, dan default.</TicketNote>
        <TicketNote ticket="TICKET-021">Manajemen direktori data, backup/restore, dan aksi hapus data.</TicketNote>
      </div>
    </div>
  );
}
