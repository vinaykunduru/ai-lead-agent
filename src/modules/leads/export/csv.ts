import { escapeCsvField } from "@/shared/lib/csv";
import type { LeadExportProvider, LeadExportRecord } from "./types";

const COLUMNS: { header: string; value: (r: LeadExportRecord) => string }[] = [
  { header: "Name", value: (r) => r.name ?? "" },
  { header: "Email", value: (r) => r.email ?? "" },
  { header: "Phone", value: (r) => r.phone ?? "" },
  { header: "Company", value: (r) => r.company ?? "" },
  { header: "Location", value: (r) => r.location ?? "" },
  { header: "Stage", value: (r) => r.stage },
  { header: "Priority", value: (r) => r.priority },
  { header: "Score", value: (r) => String(r.score) },
  { header: "Tags", value: (r) => r.tags.join("; ") },
  { header: "Next Action", value: (r) => r.summary?.recommendedNextAction ?? "" },
  { header: "Created At", value: (r) => r.createdAt },
];

/**
 * The one concrete LeadExportProvider this milestone implements — a plain,
 * dependency-free CSV file any real CRM can import manually. No network
 * call, no vendor SDK.
 */
class CsvLeadExportProvider implements LeadExportProvider {
  readonly format = "csv";
  readonly contentType = "text/csv";

  export(records: LeadExportRecord[]): string {
    const lines = [COLUMNS.map((c) => c.header).join(",")];
    for (const record of records) {
      lines.push(COLUMNS.map((c) => escapeCsvField(c.value(record))).join(","));
    }
    return lines.join("\r\n");
  }
}

export const csvLeadExportProvider: LeadExportProvider = new CsvLeadExportProvider();
