export function Skeleton({ label = "Memuat…" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      <div className="h-4 w-3/4 animate-pulse rounded-control bg-line" />
      <div className="h-4 w-full animate-pulse rounded-control bg-line" />
      <div className="h-4 w-5/6 animate-pulse rounded-control bg-line" />
    </div>
  );
}
