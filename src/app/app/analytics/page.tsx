import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/shared/components/empty-state";
import { listWidgetsForAnalyticsFilter } from "@/modules/analytics/filter-options-service";
import { getDashboardPreferences } from "@/modules/analytics/dashboard-preferences-service";
import { getExecutiveDashboard } from "@/modules/analytics/executive-service";
import { ExecutiveDashboardClient } from "./executive-dashboard-client";

export default async function AnalyticsOverviewPage() {
  const [widgets, cards, initialSummary] = await Promise.all([
    listWidgetsForAnalyticsFilter(),
    getDashboardPreferences(),
    getExecutiveDashboard({}),
  ]);

  return (
    <div className="space-y-6 p-6">
      {initialSummary.totalConversations === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No activity to analyze yet"
          description="These charts fill in automatically as your widget starts having conversations with visitors. Publish a widget to get started."
          action={<Button size="sm" render={<Link href="/app/widget">Go to Widget</Link>} />}
        />
      ) : null}
      <ExecutiveDashboardClient widgets={widgets} initialCards={cards} initialSummary={initialSummary} />
    </div>
  );
}
