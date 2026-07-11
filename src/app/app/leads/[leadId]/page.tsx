import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/shared/components/page-header";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { getLead } from "@/modules/leads/leads-service";
import { listStages } from "@/modules/leads/stages-service";
import { listTags } from "@/modules/leads/tags-service";
import { listNotes } from "@/modules/leads/notes-service";
import { getLeadTimeline } from "@/modules/leads/timeline-service";
import { listAssignableTeamMembers } from "@/modules/organizations/team-members";
import { getConversationDetail } from "@/modules/conversation/inspector-service";
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

  const [stages, tags, notes, activity, teamMembers, conversationDetail] = await Promise.all([
    listStages(),
    listTags(leadId),
    listNotes(leadId),
    getLeadTimeline(leadId),
    canViewTeam ? listAssignableTeamMembers() : Promise.resolve([]),
    lead.conversationId && canViewConversation ? getConversationDetail(lead.conversationId) : Promise.resolve(null),
  ]);

  const permissions = {
    canUpdate: can(session, "leads.update"),
    canAssign: can(session, "leads.assign"),
    canDelete: can(session, "leads.delete"),
  };

  return (
    <div>
      <div className="border-b px-6 pt-5">
        <Link href="/app/leads" className="text-sm text-muted-foreground hover:underline">
          ← Leads
        </Link>
      </div>
      <PageHeader
        title={lead.name ?? lead.email ?? lead.phone ?? "Unnamed lead"}
        description={[lead.company, lead.email, lead.phone].filter(Boolean).join(" · ") || undefined}
      />

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[2fr_1fr]">
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
          <LeadTags leadId={leadId} initialTags={tags} canUpdate={permissions.canUpdate} />
          <LeadNotes leadId={leadId} initialNotes={notes} canUpdate={permissions.canUpdate} />
        </div>
      </div>
    </div>
  );
}
