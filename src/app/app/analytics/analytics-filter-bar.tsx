"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AnalyticsFilter } from "@/modules/analytics/validation";
import type { WidgetFilterOption } from "@/modules/analytics/filter-options-service";
import type { AssignableTeamMember } from "@/modules/organizations/team-members";

const ALL = "__all__";

export type AnalyticsFilterState = AnalyticsFilter;

export function AnalyticsFilterBar({
  value,
  onChange,
  widgets,
  teamMembers,
  showAgent,
}: {
  value: AnalyticsFilterState;
  onChange: (next: AnalyticsFilterState) => void;
  widgets: WidgetFilterOption[];
  teamMembers?: AssignableTeamMember[];
  showAgent?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">From</Label>
        <Input
          type="date"
          className="w-40"
          value={value.from ? value.from.slice(0, 10) : ""}
          onChange={(e) => onChange({ ...value, from: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          type="date"
          className="w-40"
          value={value.to ? value.to.slice(0, 10) : ""}
          onChange={(e) => onChange({ ...value, to: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Widget</Label>
        <Select
          value={value.widgetId ?? ALL}
          onValueChange={(v) => onChange({ ...value, widgetId: v && v !== ALL ? v : undefined })}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All widgets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All widgets</SelectItem>
            {widgets.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showAgent && teamMembers ? (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Agent</Label>
          <Select
            value={value.agentId ?? ALL}
            onValueChange={(v) => onChange({ ...value, agentId: v && v !== ALL ? v : undefined })}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All agents</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.email ?? m.userId.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
