import { BackToProjects, PageHeader, TicketNote } from "./PageBits.js";

export function ExportsPage() {
  return (
    <div>
      <PageHeader title="Ekspor" description="Paket ZIP dan serah terima OpenCode." />
      <div className="flex flex-col gap-4">
        <TicketNote ticket="TICKET-012">Pratinjau manifest, unduh ZIP, dan instruksi handoff hadir di sini.</TicketNote>
        <BackToProjects />
      </div>
    </div>
  );
}
