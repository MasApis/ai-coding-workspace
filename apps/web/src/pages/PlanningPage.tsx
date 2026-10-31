import { useParams } from "react-router";
import { BackToProjects, PageHeader, TicketNote } from "./PageBits.js";

export function PlanningPage() {
  const { documentType } = useParams();
  return (
    <div>
      <PageHeader title="Perencanaan" description={`Jenis dokumen: ${documentType}`} />
      <div className="flex flex-col gap-4">
        <TicketNote ticket="TICKET-011">
          Editor Markdown, pratinjau, status, pemilih versi, dan panel AI hadir di sini.
        </TicketNote>
        <BackToProjects />
      </div>
    </div>
  );
}
