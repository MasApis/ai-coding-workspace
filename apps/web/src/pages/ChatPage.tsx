import { useParams } from "react-router";
import { BackToProjects, PageHeader, TicketNote } from "./PageBits.js";

export function ChatPage() {
  const { conversationId } = useParams();
  return (
    <div>
      <PageHeader title="Chat AI" description={conversationId ? `Percakapan: ${conversationId}` : "Pilih atau mulai percakapan."} />
      <div className="flex flex-col gap-4">
        <TicketNote ticket="TICKET-014">
          Model picker, streaming, stop/retry, dan riwayat hadir di sini. Konteks dokumen eksplisit di TICKET-015.
        </TicketNote>
        <BackToProjects />
      </div>
    </div>
  );
}
