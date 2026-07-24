import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/shared/components/page-header";
import { BackLink } from "@/shared/components/back-link";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { getLead } from "@/modules/leads/leads-service";
import { listStages } from "@/modules/leads/stages-service";
import { listTags } from "@/modules/leads/tags-service";
import { listNotes } from "@/modules/leads/notes-service";
import { getLeadTimeline } from "@/modules/leads/timeline-service";
import { listAssignableTeamMembers } from "@/modules/organizations/team-members";
import { getConversationDetail } from "@/modules/conversation/inspector-service";
import { getVisitorProfile } from "@/modules/visitor-profiles/service";
import { VisitorProfilePanel } from "@/shared/components/visitor-profile-panel";
import { LeadDetailActions } from "./lead-detail-actions";
import { LeadAiPanel } from "./lead-ai-panel";
import { LeadTags } from "./lead-tags";
import { LeadNotes } from "./lead-notes";
import { LeadTimeline } from "./lead-timeline";
import { LeadConversationPanel } from "./lead-conversation-panel";

export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  if (!z.string().uuid().safeParse(leadId).success) {
    notFound();
  }

  const session = await requireCompanySession();
  const lead = await getLead(leadId);
  if (!lead) {
    notFound();
  }

  const canViewConversation = can(session, "conversations.view");
  const canViewTeam = can(session, "users.view");

  const [stages, tags, notes, activity, teamMembers, conversationDetail, visitorProfile] = await Promise.all([
    listStages(),
    listTags(leadId),
    listNotes(leadId),
    getLeadTimeline(leadId),
    canViewTeam ? listAssignableTeamMembers() : Promise.resolve([]),
    lead.conversationId && canViewConversation ? getConversationDetail(lead.conversationId) : Promise.resolve(null),
    lead.visitorProfileId ? getVisitorProfile(lead.visitorProfileId) : Promise.resolve(null),
  ]);

  const permissions = {
    canUpdate: can(session, "leads.update"),
    canAssign: can(session, "leads.assign"),
    canDelete: can(session, "leads.delete"),
  };

  return (
    <div>
      <div className="border-b px-6 pt-5">
        <BackLink href="/app/leads" label="Leads" />
      </div>
      <PageHeader
        title={visitorProfile?.name ?? lead.name ?? lead.email ?? lead.phone ?? "Unnamed lead"}
        description={
          [visitorProfile?.company ?? lead.company, visitorProfile?.email ?? lead.email, visitorProfile?.phone ?? lead.phone]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[minmax(320px,2fr)_minmax(280px,1fr)]">
        <div className="space-y-4">
          <LeadAiPanel lead={lead} canUpdate={permissions.canUpdate} />
          <LeadConversationPanel detail={conversationDetail} />
          <LeadTimeline activity={activity} />
        </div>
        <div className="space-y-4">
          <LeadDetailActions
            lead={lead}
            stages={stages}
            teamMembers={teamMembers}
            canUpdate={permissions.canUpdate}
            canAssign={permissions.canAssign}
            canDelete={permissions.canDelete}
          />
          {visitorProfile ? (
            <VisitorProfilePanel profile={visitorProfile} viewHref={`/app/visitors/${visitorProfile.id}`} />
          ) : null}
          <LeadTags leadId={leadId} initialTags={tags} canUpdate={permissions.canUpdate} />
          <LeadNotes leadId={leadId} initialNotes={notes} canUpdate={permissions.canUpdate} />
        </div>
      </div>
    </div>
  );
}
