import { Link } from "react-router";
import { Button } from "../components/Button.js";
import { PageHeader, TicketNote } from "./PageBits.js";

export function TemplatesPage() {
  return (
    <div>
      <PageHeader title="Templat" description="Starter asli yang tersedia." />
      <TicketNote ticket="TICKET-019 (P1)">Katalog template adalah fitur P1, setelah MVP.</TicketNote>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div>
      <PageHeader title="Tidak ditemukan" description="Halaman yang Anda cari tidak ada." />
      <Link to="/">
        <Button>Kembali ke ringkasan</Button>
      </Link>
    </div>
  );
}
