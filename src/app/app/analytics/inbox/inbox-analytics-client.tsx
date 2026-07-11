"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { InboxAnalytics } from "@/modules/analytics/inbox-analytics-service";
import type { WidgetFilterOption } from "@/modules/analytics/filter-options-service";
import type { AssignableTeamMember } from "@/modules/organizations/team-members";
import { AnalyticsFilterBar, type AnalyticsFilterState } from "../analytics-filter-bar";
import { ExportButton } from "../export-button";
import { BarChart } from "../charts/bar-chart";
import { StatTile } from "../charts/stat-tile";

export function InboxAnalyticsClient({
  widgets,
  teamMembers,
  initial,
}: {
  widgets: WidgetFilterOption[];
  teamMembers: AssignableTeamMember[];
  initial: InboxAnalytics;
}) {
  const [filter, setFilter] = useState<AnalyticsFilterState>({});
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  const emailByUserId = useMemo(() => new Map(teamMembers.map((m) => [m.userId, m.email])), [teamMembers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (filter.from) params.set("from", filter.from);
      if (filter.to) params.set("to", filter.to);
      if (filter.widgetId) params.set("widgetId", filter.widgetId);
      if (filter.agentId) params.set("agentId", filter.agentId);

      setLoading(true);
      fetch(`/api/analytics/inbox?${params.toString()}`)
        .then((res) => res.json())
        .then((res) => setData(res.analytics))
        .catch(() => toast.error("Could not load inbox analytics"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [filter]);

  const workloadData = data.agentWorkload.map((w) => ({
    label: emailByUserId.get(w.agentId) ?? w.agentId.slice(0, 8),
    value: w.conversationCount,
  }));

  return (
    <div className={`space-y-6 ${loading ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AnalyticsFilterBar value={filter} onChange={setFilter} widgets={widgets} teamMembers={teamMembers} showAgent />
        <ExportButton report="inbox" filter={filter} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Takeovers" value={data.takeovers} />
        <StatTile label="Escalations" value={data.escalations} />
        <StatTile label="Avg response time" value={data.avgResponseTimeMs !== null ? Math.round(data.avgResponseTimeMs / 1000) : "—"} suffix={data.avgResponseTimeMs !== null ? "s" : ""} />
        <StatTile label="Avg resolution time" value={data.avgResolutionTimeMs !== null ? Math.round(data.avgResolutionTimeMs / 60000) : "—"} suffix={data.avgResolutionTimeMs !== null ? "min" : ""} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Agent workload</CardTitle></CardHeader>
        <CardContent><BarChart data={workloadData} ariaLabel="Conversations handled per agent" /></CardContent>
      </Card>
    </div>
  );
}
