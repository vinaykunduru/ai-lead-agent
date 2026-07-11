import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <Card key={key} size="sm">
          <CardHeader>
            <CardTitle className="text-xs font-normal text-muted-foreground">{label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {metrics[key]}
              {suffix ?? ""}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
