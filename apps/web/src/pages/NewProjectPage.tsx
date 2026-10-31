import { BackToProjects, PageHeader, TicketNote } from "./PageBits.js";

export function NewProjectPage() {
  return (
    <div>
      <PageHeader title="Proyek baru" description="Wizard intake ide bertahap." />
      <div className="flex flex-col gap-4">
        <TicketNote ticket="TICKET-007">Langkah: ide → audiens → stack &amp; batasan → ulasan → simpan via API.</TicketNote>
        <BackToProjects />
      </div>
    </div>
  );
}
