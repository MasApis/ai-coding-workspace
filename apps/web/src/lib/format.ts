const formatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });

export function formatDateTime(iso: string): string {
  return formatter.format(new Date(iso));
}
