"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { WidgetAnalytics } from "@/modules/analytics/widget-analytics-service";
import type { WidgetFilterOption } from "@/modules/analytics/filter-options-service";
import { AnalyticsFilterBar, type AnalyticsFilterState } from "../analytics-filter-bar";
import { ExportButton } from "../export-button";
import { BarChart } from "../charts/bar-chart";
import { StatTile } from "../charts/stat-tile";

export function WidgetAnalyticsClient({
  widgets,
  initial,
}: {
  widgets: WidgetFilterOption[];
  initial: WidgetAnalytics;
}) {
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
      fetch(`/api/analytics/widgets?${params.toString()}`)
        .then((res) => res.json())
        .then((res) => setData(res.analytics))
        .catch(() => toast.error("Could not load widget analytics"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [filter]);

  const performanceData = data.widgetPerformance.map((p) => ({ label: p.name, value: p.avgLatencyMs }));

  return (
    <div className={`space-y-6 ${loading ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AnalyticsFilterBar value={filter} onChange={setFilter} widgets={widgets} />
        <ExportButton report="widgets" filter={filter} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Visitors" value={data.visitors} />
        <StatTile label="Conversations started" value={data.conversationsStarted} />
        <StatTile label="Bounce rate" value={data.bounceRate} suffix="%" />
        <StatTile label="Conversation completion" value={data.conversationCompletion} suffix="%" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Avg response latency by widget</CardTitle></CardHeader>
        <CardContent><BarChart data={performanceData} formatValue={(v) => `${v}ms`} ariaLabel="Average response latency by widget" /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Widget performance</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Widget</TableHead>
                <TableHead>Conversations</TableHead>
                <TableHead>Avg latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.widgetPerformance.map((p) => (
                <TableRow key={p.widgetId}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.conversationCount}</TableCell>
                  <TableCell className="text-muted-foreground">{p.avgLatencyMs}ms</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
