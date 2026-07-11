"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EXPORT_REPORTS } from "@/modules/analytics/validation";
import type { AnalyticsFilterState } from "./analytics-filter-bar";

export function ExportButton({
  report,
  filter,
}: {
  report: (typeof EXPORT_REPORTS)[number];
  filter: AnalyticsFilterState;
}) {
  function buildUrl(format: "csv" | "json") {
    const params = new URLSearchParams({ report, format });
    if (filter.from) params.set("from", filter.from);
    if (filter.to) params.set("to", filter.to);
    if (filter.widgetId) params.set("widgetId", filter.widgetId);
    if (filter.agentId) params.set("agentId", filter.agentId);
    if (filter.stageId) params.set("stageId", filter.stageId);
    if (filter.language) params.set("language", filter.language);
    if (filter.provider) params.set("provider", filter.provider);
    return `/api/analytics/export?${params.toString()}`;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm">Export</Button>} />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => window.open(buildUrl("csv"), "_blank")}>Export CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open(buildUrl("json"), "_blank")}>Export JSON</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
