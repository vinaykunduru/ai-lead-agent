import { PageHeader } from "@/shared/components/page-header";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { listLeads } from "@/modules/leads/leads-service";
import { listStages } from "@/modules/leads/stages-service";
import { getLeadDashboardMetrics } from "@/modules/leads/dashboard-service";
import { listAssignableTeamMembers } from "@/modules/organizations/team-members";
import { LeadDashboardMetricsGrid } from "./lead-dashboard-metrics";
import { LeadsBoard } from "./leads-board";

export default async function LeadsPage() {
  const session = await requireCompanySession();

  const [leads, stages, metrics, teamMembers] = await Promise.all([
    listLeads(),
    listStages(),
    getLeadDashboardMetrics(),
    can(session, "users.view") ? listAssignableTeamMembers() : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader title="Leads" description="Leads captured from your website widget, with AI scoring and summaries." />
      <div className="space-y-6 p-6">
        <LeadDashboardMetricsGrid metrics={metrics} />
        <LeadsBoard
          initialLeads={leads}
          stages={stages}
          teamMembers={teamMembers}
          canCreate={can(session, "leads.create")}
          canUpdate={can(session, "leads.update")}
          canDelete={can(session, "leads.delete")}
        />
      </div>
    </div>
  );
}
