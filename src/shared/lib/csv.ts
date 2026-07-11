/** RFC 4180 field escaping — quote a field only if it contains a comma,
 * quote, or newline, doubling any embedded quotes. Shared by every CSV
 * exporter in the app (modules/leads/export/csv.ts, modules/analytics)
 * rather than reimplemented per module. */
export function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
