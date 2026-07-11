import { evaluateAlerts } from "@/modules/analytics/alerts-service";
import { AlertsClient } from "./alerts-client";

export default async function AnalyticsAlertsPage() {
  const rules = await evaluateAlerts();

  return (
    <div className="p-6">
      <AlertsClient initialRules={rules} />
    </div>
  );
}
