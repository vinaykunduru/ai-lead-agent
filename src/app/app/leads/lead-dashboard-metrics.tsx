import { StatTile } from "@/app/app/analytics/charts/stat-tile";
import type { LeadDashboardMetrics } from "@/modules/leads/dashboard-service";

const METRIC_LABELS: { key: keyof LeadDashboardMetrics; label: string; suffix?: string }[] = [
  { key: "newLeads", label: "New leads (30d)" },
  { key: "qualifiedLeads", label: "Qualified leads" },
  { key: "conversionRate", label: "Conversion rate", suffix: "%" },
  { key: "averageScore", label: "Average AI score" },
  { key: "openConversations", label: "Open conversations" },
  { key: "humanTakeovers", label: "Human takeovers" },
  { key: "meetings", label: "Meetings" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

export function LeadDashboardMetricsGrid({ metrics }: { metrics: LeadDashboardMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {METRIC_LABELS.map(({ key, label, suffix }) => (
        <StatTile key={key} label={label} value={metrics[key]} suffix={suffix} />
      ))}
    </div>
  );
}
