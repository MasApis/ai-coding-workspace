import { BackToProjects, PageHeader, TicketNote } from "./PageBits.js";

export function TasksPage() {
  return (
    <div>
      <PageHeader title="Tugas" description="Daftar tugas dan serah terima OpenCode." />
      <div className="flex flex-col gap-4">
        <TicketNote ticket="TICKET-012">Daftar tugas, status, dan panel ekspor OpenCode hadir di sini.</TicketNote>
        <BackToProjects />
      </div>
    </div>
  );
}
