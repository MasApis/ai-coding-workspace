// Loading placeholders mirror the shape of what they replace: line lists get
// N bars, so the layout does not jump when data arrives.
export function Skeleton({ label = "Memuat…", lines = 3 }: { label?: string; lines?: number }) {
  const count = Math.max(1, Math.min(12, Math.floor(lines)));
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={`h-4 animate-pulse rounded-control bg-line ${i % 3 === 0 ? "w-full" : i % 3 === 1 ? "w-5/6" : "w-3/4"}`}
        />
      ))}
    </div>
  );
}
