import { Link } from "react-router";

// Honest empty state: no provider is configured until AI-024/AI-025.
// Never show a green "connected" indicator without a real check.
export function AIConnectionIndicator() {
  return (
    <Link
      to="/settings"
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-soft hover:text-ink"
      title="Buka pengaturan AI"
    >
      <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-ink-soft" />
      AI belum dikonfigurasi
    </Link>
  );
}
