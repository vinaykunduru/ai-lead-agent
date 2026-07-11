"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadAnalytics } from "@/modules/analytics/lead-analytics-service";
import type { WidgetFilterOption } from "@/modules/analytics/filter-options-service";
import { AnalyticsFilterBar, type AnalyticsFilterState } from "../analytics-filter-bar";
import { ExportButton } from "../export-button";
import { BarChart } from "../charts/bar-chart";
import { DonutChart } from "../charts/donut-chart";
import { StatTile } from "../charts/stat-tile";

export function LeadAnalyticsClient({ widgets, initial }: { widgets: WidgetFilterOption[]; initial: LeadAnalytics }) {
  const [filter, setFilter] = useState<AnalyticsFilterState>({});
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (filter.from) params.set("from", filter.from);
      if (filter.to) params.set("to", filter.to);
      if (filter.widgetId) params.set("widgetId", filter.widgetId);

      setLoading(true);
      fetch(`/api/analytics/leads?${params.toString()}`)
        .then((res) => res.json())
        .then((res) => setData(res.analytics))
        .catch(() => toast.error("Could not load lead analytics"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [filter]);

  const funnelData = data.funnel
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => ({ label: f.name, value: f.countAtOrBeyond }));
  const distributionData = data.pipelineDistribution.map((s) => ({ label: s.name, value: s.count }));

  return (
    <div className={`space-y-6 ${loading ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AnalyticsFilterBar value={filter} onChange={setFilter} widgets={widgets} />
        <ExportButton report="leads" filter={filter} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="Average AI score" value={data.averageScore} />
        <StatTile label="Qualified leads" value={data.qualifiedLeads} />
        <StatTile label="Conversion rate" value={data.conversionRate} suffix="%" />
        <StatTile label="Won" value={data.won} />
        <StatTile label="Lost" value={data.lost} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversion funnel</CardTitle>
            <p className="text-xs text-muted-foreground">Leads at this stage or further along the pipeline.</p>
          </CardHeader>
          <CardContent><BarChart data={funnelData} ariaLabel="Lead conversion funnel by stage" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Pipeline distribution</CardTitle></CardHeader>
          <CardContent><DonutChart data={distributionData} ariaLabel="Current lead distribution by stage" /></CardContent>
        </Card>
      </div>
    </div>
  );
}
