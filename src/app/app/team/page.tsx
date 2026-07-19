import { Users } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { listAssignableTeamMembers } from "@/modules/organizations/team-members";

const ROLE_BADGE_VARIANT = {
  owner: "default",
  admin: "default",
  manager: "secondary",
  agent: "secondary",
  viewer: "outline",
} as const;

export default async function TeamPage() {
  const session = await requireCompanySession();
  const canViewTeam = can(session, "users.view");
  const members = canViewTeam ? await listAssignableTeamMembers() : [];

  return (
    <div>
      <PageHeader title="Team" description="Everyone with access to this workspace." />
      <div className="p-6">
        {!canViewTeam ? (
          <EmptyState
            icon={Users}
            title="You don't have access to team info"
            description="Ask an owner or admin on your team if you need to see who else has access."
          />
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="It's just you for now"
            description="New teammates are added by your platform administrator — ask them to invite the next person."
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border bg-card shadow-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.userId}>
                      <TableCell className="font-medium">
                        {member.email ?? "—"}
                        {member.userId === session.userId ? (
                          <span className="ml-2 text-caption text-muted-foreground">(You)</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ROLE_BADGE_VARIANT[member.role as keyof typeof ROLE_BADGE_VARIANT] ?? "outline"} className="capitalize">
                          {member.role}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-4 text-caption text-muted-foreground">
              Want to add someone? New teammates are invited by your platform administrator, not from here.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
