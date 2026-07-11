import "server-only";
import { escapeCsvField } from "@/shared/lib/csv";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { getExecutiveDashboard } from "./executive-service";
import { getConversationAnalytics } from "./conversation-analytics-service";
import { getLeadAnalytics } from "./lead-analytics-service";
import { getAiPerformance } from "./ai-performance-service";
import { getKnowledgeAnalytics } from "./knowledge-analytics-service";
import { getInboxAnalytics } from "./inbox-analytics-service";
import { getWidgetAnalytics } from "./widget-analytics-service";
import type { ExportQuery } from "./validation";

export type ExportResult = { content: string; contentType: string; filename: string };

async function fetchReportData(query: ExportQuery): Promise<Record<string, unknown>> {
  switch (query.report) {
    case "executive":
      return getExecutiveDashboard(query);
    case "conversations":
      return getConversationAnalytics({ ...query, bucket: "day" });
    case "leads":
      return getLeadAnalytics(query);
    case "ai":
      return getAiPerformance(query);
    case "knowledge":
      return getKnowledgeAnalytics(query);
    case "inbox":
      return getInboxAnalytics(query);
    case "widgets":
      return getWidgetAnalytics(query);
  }
}

/** Exported for unit testing (pure, no I/O) — same reasoning as
 * modules/leads/scoring.ts's computeLeadScore. */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Every report is a mix of scalar metrics and a few arrays of rows (a time
 * series, a breakdown by widget/provider/stage, ...) — this flattens any of
 * them the same way rather than hand-writing per-report CSV columns:
 * scalars become one "Metric,Value" table, each array field becomes its
 * own titled table below it. Reuses the same field-escaping rule as
 * modules/leads/export/csv.ts (shared/lib/csv.ts), not reimplemented.
 */
export function toCsv(data: Record<string, unknown>): string {
  const lines: string[] = ["Metric,Value"];
  const arrayFields: [string, Record<string, unknown>[]][] = [];

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      arrayFields.push([key, value as Record<string, unknown>[]]);
    } else {
      lines.push(`${escapeCsvField(key)},${escapeCsvField(formatCell(value))}`);
    }
  }

  for (const [fieldName, rows] of arrayFields) {
    lines.push("", escapeCsvField(fieldName));
    if (rows.length === 0) continue;
    const headers = Object.keys(rows[0]);
    lines.push(headers.map(escapeCsvField).join(","));
    for (const row of rows) {
      lines.push(headers.map((h) => escapeCsvField(formatCell(row[h]))).join(","));
    }
  }

  return lines.join("\r\n");
}

export async function exportAnalyticsReport(query: ExportQuery): Promise<ExportResult> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.export");

  const data = await fetchReportData(query);

  const content = query.format === "csv" ? toCsv(data) : JSON.stringify(data, null, 2);
  const contentType = query.format === "csv" ? "text/csv" : "application/json";
  const filename = `analytics-${query.report}-${new Date().toISOString().slice(0, 10)}.${query.format}`;

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "analytics.exported",
    resourceType: "analytics_report",
    metadata: { report: query.report, format: query.format },
  });

  return { content, contentType, filename };
}
