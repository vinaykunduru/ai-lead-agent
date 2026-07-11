import { listWidgetsForAnalyticsFilter } from "@/modules/analytics/filter-options-service";
import { listAssignableTeamMembers } from "@/modules/organizations/team-members";
import { getInboxAnalytics } from "@/modules/analytics/inbox-analytics-service";
import { InboxAnalyticsClient } from "./inbox-analytics-client";

export default async function InboxAnalyticsPage() {
  const [widgets, teamMembers, initial] = await Promise.all([
    listWidgetsForAnalyticsFilter(),
    listAssignableTeamMembers(),
    getInboxAnalytics({}),
  ]);

  return (
    <div className="p-6">
      <InboxAnalyticsClient widgets={widgets} teamMembers={teamMembers} initial={initial} />
    </div>
  );
}
