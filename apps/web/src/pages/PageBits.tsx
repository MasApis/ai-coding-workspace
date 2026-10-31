export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
    </div>
  );
}

export function TicketNote({ ticket, children }: { ticket: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface p-4 text-sm text-ink-soft">
      <p className="font-medium text-ink">Hadir di {ticket}</p>
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}
