import { ButtonLink } from "../components/ButtonLink.js";
import { PageHeader } from "./PageBits.js";

export function NotFoundPage() {
  return (
    <div>
      <PageHeader title="Tidak ditemukan" description="Halaman yang Anda cari tidak ada." />
      <ButtonLink to="/">Kembali ke ringkasan</ButtonLink>
    </div>
  );
}
