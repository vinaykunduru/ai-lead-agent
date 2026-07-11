import { listWidgetsForAnalyticsFilter } from "@/modules/analytics/filter-options-service";
import { getKnowledgeAnalytics } from "@/modules/analytics/knowledge-analytics-service";
import { KnowledgeAnalyticsClient } from "./knowledge-analytics-client";

export default async function KnowledgeAnalyticsPage() {
  const [widgets, initial] = await Promise.all([listWidgetsForAnalyticsFilter(), getKnowledgeAnalytics({})]);

  return (
    <div className="p-6">
      <KnowledgeAnalyticsClient widgets={widgets} initial={initial} />
    </div>
  );
}
