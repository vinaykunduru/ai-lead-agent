import { listWidgetsForAnalyticsFilter } from "@/modules/analytics/filter-options-service";
import { getAiPerformance } from "@/modules/analytics/ai-performance-service";
import { AiPerformanceClient } from "./ai-performance-client";

export default async function AiPerformancePage() {
  const [widgets, initial] = await Promise.all([listWidgetsForAnalyticsFilter(), getAiPerformance({})]);

  return (
    <div className="p-6">
      <AiPerformanceClient widgets={widgets} initial={initial} />
    </div>
  );
}
