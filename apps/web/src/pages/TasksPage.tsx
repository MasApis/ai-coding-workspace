import { TicketNote } from "./PageBits.js";

export function TasksPage() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Tugas</h2>
        <p className="mt-1 text-sm text-ink-soft">Daftar tugas dan serah terima OpenCode.</p>
      </div>
      <TicketNote ticket="TICKET-012">Daftar tugas, status, dan panel ekspor OpenCode hadir di sini.</TicketNote>
    </div>
  );
}
