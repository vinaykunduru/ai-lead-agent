import { listWidgetsForAnalyticsFilter } from "@/modules/analytics/filter-options-service";
import { getLeadAnalytics } from "@/modules/analytics/lead-analytics-service";
import { LeadAnalyticsClient } from "./lead-analytics-client";

export default async function LeadAnalyticsPage() {
  const [widgets, initial] = await Promise.all([listWidgetsForAnalyticsFilter(), getLeadAnalytics({})]);

  return (
    <div className="p-6">
      <LeadAnalyticsClient widgets={widgets} initial={initial} />
    </div>
  );
}
