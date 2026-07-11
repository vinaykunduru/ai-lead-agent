import { listWidgetsForAnalyticsFilter } from "@/modules/analytics/filter-options-service";
import { listAssignableTeamMembers } from "@/modules/organizations/team-members";
import { getConversationAnalytics } from "@/modules/analytics/conversation-analytics-service";
import { ConversationAnalyticsClient } from "./conversation-analytics-client";

export default async function ConversationAnalyticsPage() {
  const [widgets, teamMembers, initial] = await Promise.all([
    listWidgetsForAnalyticsFilter(),
    listAssignableTeamMembers(),
    getConversationAnalytics({ bucket: "day" }),
  ]);

  return (
    <div className="p-6">
      <ConversationAnalyticsClient widgets={widgets} teamMembers={teamMembers} initial={initial} />
    </div>
  );
}
