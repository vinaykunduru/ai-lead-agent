"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ExecutiveDashboard } from "@/modules/analytics/executive-service";
import type { WidgetFilterOption } from "@/modules/analytics/filter-options-service";
import type { DashboardCardPreference } from "@/modules/analytics/dashboard-preferences-service";
import { AnalyticsFilterBar, type AnalyticsFilterState } from "./analytics-filter-bar";
import { ExportButton } from "./export-button";
import { StatTile } from "./charts/stat-tile";

const CARD_META: Record<
  DashboardCardPreference["key"],
  { label: string; format: (s: ExecutiveDashboard) => { value: string | number; suffix?: string } }
> = {
  totalConversations: { label: "Total conversations", format: (s) => ({ value: s.totalConversations }) },
  activeConversations: { label: "Active conversations", format: (s) => ({ value: s.activeConversations }) },
  leadsGenerated: { label: "Leads generated", format: (s) => ({ value: s.leadsGenerated }) },
  conversionRate: { label: "Conversion rate", format: (s) => ({ value: s.conversionRate, suffix: "%" }) },
  humanTakeovers: { label: "Human takeovers", format: (s) => ({ value: s.humanTakeovers }) },
  aiResolutionRate: { label: "AI resolution rate", format: (s) => ({ value: s.aiResolutionRate, suffix: "%" }) },
  avgResponseTimeMs: {
    label: "Avg response time",
    format: (s) => ({ value: s.avgResponseTimeMs !== null ? Math.round(s.avgResponseTimeMs) : "—", suffix: s.avgResponseTimeMs !== null ? "ms" : "" }),
  },
  avgConversationLength: { label: "Avg conversation length", format: (s) => ({ value: s.avgConversationLength, suffix: " msgs" }) },
  csat: { label: "CSAT", format: () => ({ value: "—" }) },
  estimatedCostUsd: { label: "Estimated AI cost", format: (s) => ({ value: `$${s.estimatedCostUsd.toFixed(2)}` }) },
};

export function ExecutiveDashboardClient({
  widgets,
  initialCards,
  initialSummary,
}: {
  widgets: WidgetFilterOption[];
  initialCards: DashboardCardPreference[];
  initialSummary: ExecutiveDashboard;
}) {
  const [filter, setFilter] = useState<AnalyticsFilterState>({});
  const [summary, setSummary] = useState(initialSummary);
  const [cards, setCards] = useState(initialCards);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (filter.from) params.set("from", filter.from);
      if (filter.to) params.set("to", filter.to);
      if (filter.widgetId) params.set("widgetId", filter.widgetId);

      setLoading(true);
      fetch(`/api/analytics/summary?${params.toString()}`)
        .then((res) => res.json())
        .then((data) => setSummary(data.summary))
        .catch(() => toast.error("Could not load the dashboard"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [filter]);

  const orderedCards = [...cards].sort((a, b) => a.sortOrder - b.sortOrder).filter((c) => c.visible);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AnalyticsFilterBar value={filter} onChange={setFilter} widgets={widgets} />
        <div className="flex items-center gap-2">
          <CustomizeDashboardDialog cards={cards} onSave={setCards} />
          <ExportButton report="executive" filter={filter} />
        </div>
      </div>

      <div
        className={`grid grid-cols-2 gap-3 transition-opacity duration-150 sm:grid-cols-3 lg:grid-cols-5 ${loading ? "opacity-60" : ""}`}
        aria-busy={loading}
      >
        {orderedCards.map((card) => {
          const meta = CARD_META[card.key];
          const { value, suffix } = meta.format(summary);
          return <StatTile key={card.key} label={meta.label} value={value} suffix={suffix} />;
        })}
      </div>
    </div>
  );
}

function CustomizeDashboardDialog({
  cards,
  onSave,
}: {
  cards: DashboardCardPreference[];
  onSave: (cards: DashboardCardPreference[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(cards);
  const [pending, setPending] = useState(false);

  function toggle(key: DashboardCardPreference["key"]) {
    setDraft((prev) => prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c)));
  }

  function move(key: DashboardCardPreference["key"], direction: -1 | 1) {
    setDraft((prev) => {
      const sorted = [...prev].sort((a, b) => a.sortOrder - b.sortOrder);
      const index = sorted.findIndex((c) => c.key === key);
      const swapWith = index + direction;
      if (swapWith < 0 || swapWith >= sorted.length) return prev;
      [sorted[index].sortOrder, sorted[swapWith].sortOrder] = [sorted[swapWith].sortOrder, sorted[index].sortOrder];
      return sorted.map((c, i) => ({ ...c, sortOrder: i }));
    });
  }

  async function save() {
    setPending(true);
    const res = await fetch("/api/analytics/dashboard-preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cards: draft }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Could not save dashboard layout");
      return;
    }
    onSave(draft);
    toast.success("Dashboard updated");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Customize</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dashboard cards</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {[...draft]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((card) => (
              <div key={card.key} className="flex items-center justify-between gap-2 rounded-md border p-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={card.visible} onCheckedChange={() => toggle(card.key)} />
                  {CARD_META[card.key].label}
                </label>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => move(card.key, -1)}>↑</Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => move(card.key, 1)}>↓</Button>
                </div>
              </div>
            ))}
        </div>
        <DialogFooter>
          <Button onClick={save} loading={pending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
