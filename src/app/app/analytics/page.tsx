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
    <div className="p-6">
      <ExecutiveDashboardClient widgets={widgets} initialCards={cards} initialSummary={initialSummary} />
    </div>
  );
}
