"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/shared/components/empty-state";
import type { KnowledgeAnalytics } from "@/modules/analytics/knowledge-analytics-service";
import type { WidgetFilterOption } from "@/modules/analytics/filter-options-service";
import { AnalyticsFilterBar, type AnalyticsFilterState } from "../analytics-filter-bar";
import { ExportButton } from "../export-button";
import { BarChart } from "../charts/bar-chart";
import { StatTile } from "../charts/stat-tile";

export function KnowledgeAnalyticsClient({
  widgets,
  initial,
}: {
  widgets: WidgetFilterOption[];
  initial: KnowledgeAnalytics;
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
      fetch(`/api/analytics/knowledge?${params.toString()}`)
        .then((res) => res.json())
        .then((res) => setData(res.analytics))
        .catch(() => toast.error("Could not load knowledge analytics"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [filter]);

  const documentData = data.mostUsedDocuments.map((d) => ({ label: d.title, value: d.citationCount }));
  const chunkData = data.mostRetrievedChunks.map((c) => ({ label: c.documentTitle, value: c.citationCount }));

  return (
    <div className={`space-y-6 ${loading ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AnalyticsFilterBar value={filter} onChange={setFilter} widgets={widgets} />
        <ExportButton report="knowledge" filter={filter} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Search success rate" value={data.searchSuccessRate} suffix="%" />
        <StatTile label="No-match rate" value={data.noMatchRate} suffix="%" hint={`${data.noMatchQuestions} replies with no citation`} />
        <StatTile label="Knowledge coverage" value={data.knowledgeCoverage} suffix="%" />
        <StatTile label="Unused documents" value={data.unusedDocuments.length} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Most used documents</CardTitle></CardHeader>
          <CardContent><BarChart data={documentData} ariaLabel="Most cited documents" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Most retrieved chunks</CardTitle></CardHeader>
          <CardContent><BarChart data={chunkData} ariaLabel="Most cited chunks by document" /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Unused documents</CardTitle></CardHeader>
        <CardContent>
          {data.unusedDocuments.length === 0 ? (
            <EmptyState title="Every ready document has been used" description="No unused documents right now." />
          ) : (
            <ul className="list-inside list-disc text-sm">
              {data.unusedDocuments.map((d) => (
                <li key={d.documentId}>{d.title}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
