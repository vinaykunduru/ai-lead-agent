"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ConversationAnalytics } from "@/modules/analytics/conversation-analytics-service";
import type { WidgetFilterOption } from "@/modules/analytics/filter-options-service";
import type { AssignableTeamMember } from "@/modules/organizations/team-members";
import { CONVERSATION_BUCKETS } from "@/modules/analytics/validation";
import { AnalyticsFilterBar, type AnalyticsFilterState } from "../analytics-filter-bar";
import { ExportButton } from "../export-button";
import { BarChart } from "../charts/bar-chart";
import { StatTile } from "../charts/stat-tile";

export function ConversationAnalyticsClient({
  widgets,
  teamMembers,
  initial,
}: {
  widgets: WidgetFilterOption[];
  teamMembers: AssignableTeamMember[];
  initial: ConversationAnalytics;
}) {
  const [filter, setFilter] = useState<AnalyticsFilterState>({});
  const [bucket, setBucket] = useState<(typeof CONVERSATION_BUCKETS)[number]>("day");
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  const emailByUserId = useMemo(() => new Map(teamMembers.map((m) => [m.userId, m.email])), [teamMembers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ bucket });
      if (filter.from) params.set("from", filter.from);
      if (filter.to) params.set("to", filter.to);
      if (filter.widgetId) params.set("widgetId", filter.widgetId);

      setLoading(true);
      fetch(`/api/analytics/conversations?${params.toString()}`)
        .then((res) => res.json())
        .then((res) => setData(res.analytics))
        .catch(() => toast.error("Could not load conversation analytics"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [filter, bucket]);

  const seriesData = data.series.map((p) => ({ label: new Date(p.bucket).toLocaleDateString(), value: p.count }));
  const widgetData = data.byWidget.map((c) => ({ label: c.label, value: c.count }));
  const languageData = data.byLanguage.map((c) => ({ label: c.label, value: c.count }));
  const agentData = data.byAgent.map((c) => ({ label: emailByUserId.get(c.key) ?? c.key.slice(0, 8), value: c.count }));

  return (
    <div className={`space-y-6 ${loading ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AnalyticsFilterBar value={filter} onChange={setFilter} widgets={widgets} />
        <ExportButton report="conversations" filter={filter} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Conversations over time</CardTitle>
          <Select value={bucket} onValueChange={(v) => v && setBucket(v as typeof bucket)}>
            <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONVERSATION_BUCKETS.map((b) => (
                <SelectItem key={b} value={b} className="capitalize">{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <BarChart data={seriesData} ariaLabel="Conversations over time" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">By widget</CardTitle></CardHeader>
          <CardContent><BarChart data={widgetData} ariaLabel="Conversations by widget" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">By agent</CardTitle></CardHeader>
          <CardContent>
            {agentData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No agent-assigned conversations yet.</p>
            ) : (
              <BarChart data={agentData} ariaLabel="Conversations by agent" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">By language</CardTitle></CardHeader>
          <CardContent><BarChart data={languageData} ariaLabel="Conversations by language" /></CardContent>
        </Card>
        <StatTile
          label="By source"
          value={data.bySource[0]?.count ?? 0}
          hint={`${data.bySource[0]?.label ?? "—"} — the only channel implemented today`}
        />
      </div>
    </div>
  );
}
