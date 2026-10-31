import { useState } from "react";
import { Alert } from "../components/Alert.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Dialog } from "../components/Dialog.js";
import { Skeleton } from "../components/Skeleton.js";
import { Select, TextArea, TextInput } from "../components/TextField.js";

// Temporary TICKET-003 variant demo. Replaced by routing in TICKET-004.
export function ComponentDemo() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">AI Coding Workspace</h1>
        <p className="text-sm text-ink-soft">Demo varian komponen — TICKET-003. Satu aksi primer per layar.</p>
        <div>
          <Button onClick={() => setDialogOpen(true)}>Buat proyek baru</Button>
        </div>
      </header>

      <section aria-labelledby="s-buttons" className="flex flex-col gap-3">
        <h2 id="s-buttons" className="text-lg font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section aria-labelledby="s-fields" className="flex max-w-xl flex-col gap-4">
        <h2 id="s-fields" className="text-lg font-semibold">Form fields</h2>
        <TextInput label="Nama proyek" placeholder="cth. todo-list" hint="Minimal 3 karakter." />
        <TextInput label="Dengan error" defaultValue="x" error="Nama terlalu pendek." />
        <TextArea label="Deskripsi ide" placeholder="Ceritakan yang ingin dibangun…" />
        <Select label="Status" defaultValue="active">
          <option value="active">Aktif</option>
          <option value="archived">Arsip</option>
        </Select>
      </section>

      <section aria-labelledby="s-status" className="flex flex-col gap-3">
        <h2 id="s-status" className="text-lg font-semibold">Status &amp; badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>Draft</Badge>
          <Badge variant="accent">Direview</Badge>
          <Badge variant="success">Disetujui</Badge>
          <Badge variant="warning">Usang</Badge>
          <Badge variant="error">Gagal</Badge>
        </div>
      </section>

      <section aria-labelledby="s-states" className="flex flex-col gap-3">
        <h2 id="s-states" className="text-lg font-semibold">Loading / empty / error</h2>
        <Skeleton />
        <Alert variant="empty" title="Belum ada proyek">
          Buat proyek pertama Anda untuk mulai merencanakan.
        </Alert>
        <Alert variant="error" title="Koneksi AI terputus">
          Periksa layanan lokal lalu coba lagi. Tidak ada data yang hilang.
        </Alert>
      </section>

      <section aria-labelledby="s-dialogs" className="flex flex-col gap-3">
        <h2 id="s-dialogs" className="text-lg font-semibold">Dialogs</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>Buka dialog</Button>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>Hapus proyek</Button>
        </div>
      </section>

      <Dialog open={dialogOpen} title="Buat proyek" onClose={() => setDialogOpen(false)} confirmLabel="Simpan" onConfirm={() => setDialogOpen(false)}>
        <p>Form proyek akan hadir di TICKET-007. Dialog ini menutup dengan Escape atau backdrop.</p>
      </Dialog>
      <Dialog
        open={confirmOpen}
        title="Hapus proyek?"
        onClose={() => setConfirmOpen(false)}
        confirmLabel="Ya, hapus"
        destructive
        onConfirm={() => setConfirmOpen(false)}
      >
        <p>Tindakan ini tidak dapat dibatalkan.</p>
      </Dialog>
    </main>
  );
}
