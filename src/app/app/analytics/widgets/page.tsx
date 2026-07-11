import { listWidgetsForAnalyticsFilter } from "@/modules/analytics/filter-options-service";
import { getWidgetAnalytics } from "@/modules/analytics/widget-analytics-service";
import { WidgetAnalyticsClient } from "./widget-analytics-client";

export default async function WidgetAnalyticsPage() {
  const [widgets, initial] = await Promise.all([listWidgetsForAnalyticsFilter(), getWidgetAnalytics({})]);

  return (
    <div className="p-6">
      <WidgetAnalyticsClient widgets={widgets} initial={initial} />
    </div>
  );
}
