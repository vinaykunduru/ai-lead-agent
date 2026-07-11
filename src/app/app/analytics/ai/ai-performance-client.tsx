"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AiPerformance } from "@/modules/analytics/ai-performance-service";
import type { WidgetFilterOption } from "@/modules/analytics/filter-options-service";
import { AnalyticsFilterBar, type AnalyticsFilterState } from "../analytics-filter-bar";
import { ExportButton } from "../export-button";
import { DonutChart } from "../charts/donut-chart";
import { StatTile } from "../charts/stat-tile";

export function AiPerformanceClient({ widgets, initial }: { widgets: WidgetFilterOption[]; initial: AiPerformance }) {
  const [filter, setFilter] = useState<AnalyticsFilterState>({});
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (filter.from) params.set("from", filter.from);
      if (filter.to) params.set("to", filter.to);
      if (filter.widgetId) params.set("widgetId", filter.widgetId);
      if (filter.provider) params.set("provider", filter.provider);

      setLoading(true);
      fetch(`/api/analytics/ai?${params.toString()}`)
        .then((res) => res.json())
        .then((res) => setData(res.analytics))
        .catch(() => toast.error("Could not load AI performance analytics"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [filter]);

  const providerData = data.providerUsage.map((p) => ({ label: p.key, value: p.count }));
  const modelData = data.modelUsage.map((m) => ({ label: m.key, value: m.count }));

  return (
    <div className={`space-y-6 ${loading ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AnalyticsFilterBar value={filter} onChange={setFilter} widgets={widgets} />
        <ExportButton report="ai" filter={filter} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Avg tokens / reply" value={data.avgTokens} />
        <StatTile label="Avg prompt tokens" value={data.avgPromptTokens} />
        <StatTile label="Avg completion tokens" value={data.avgCompletionTokens} />
        <StatTile label="Avg latency" value={data.avgLatencyMs} suffix="ms" />
        <StatTile label="Estimated cost" value={`$${data.estimatedCostUsd.toFixed(2)}`} />
        <StatTile label="Failure rate" value={data.failureRate} suffix="%" />
        <StatTile label="Retry recovery rate" value={data.retryRate} suffix="%" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Provider usage</CardTitle></CardHeader>
          <CardContent><DonutChart data={providerData} ariaLabel="AI provider usage share" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Model usage</CardTitle></CardHeader>
          <CardContent><DonutChart data={modelData} ariaLabel="AI model usage share" /></CardContent>
        </Card>
      </div>
    </div>
  );
}
