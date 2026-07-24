import Link from "next/link";
import { Inbox as InboxIcon, ListFilter } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { listInboxConversations } from "@/modules/inbox/inbox-service";
import { inboxQuerySchema } from "@/modules/leads/validation";
import { listAssignableTeamMembers } from "@/modules/organizations/team-members";
import { InboxTabs } from "./inbox-tabs";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCompanySession();
  const raw = await searchParams;
  const parsed = inboxQuerySchema.safeParse({ view: raw.view });
  const query = parsed.success ? parsed.data : { view: "all" as const };

  const [conversations, teamMembers] = await Promise.all([
    listInboxConversations(query),
    can(session, "users.view") ? listAssignableTeamMembers() : Promise.resolve([]),
  ]);
  const emailByUserId = new Map(teamMembers.map((m) => [m.userId, m.email]));

  return (
    <div>
      <PageHeader title="Inbox" description="Human takeover of AI conversations — reply directly to visitors." />
      <InboxTabs activeView={query.view} />
      <div className="p-6">
        {conversations.length === 0 ? (
          query.view === "all" ? (
            <EmptyState
              icon={InboxIcon}
              title="Your inbox is empty"
              description="Conversations land here when the AI needs a hand — either a visitor asks for a person, or your escalation settings hand it over automatically. Nothing to do until then."
            />
          ) : (
            <EmptyState
              icon={ListFilter}
              title="No conversations in this view"
              description="Nothing matches this filter right now. Switch back to All to see every conversation."
              action={
                <Button variant="outline" size="sm" render={<Link href="/app/inbox">View all</Link>} />
              }
            />
          )
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Widget</TableHead>
                  <TableHead>Visitor</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Lead score</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((conversation) => {
                  const unread = !conversation.lastReadAt || conversation.lastActivityAt > conversation.lastReadAt;
                  return (
                    <TableRow key={conversation.id}>
                      <TableCell>
                        <Link href={`/app/inbox/${conversation.id}`} className="flex items-center gap-2 font-medium hover:underline">
                          {unread ? <span className="size-1.5 shrink-0 rounded-full bg-primary" /> : null}
                          {conversation.widgetName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {conversation.visitorName ?? <span className="italic">Unknown</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{conversation.visitorCompany ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{conversation.visitorPhone ?? "—"}</TableCell>
                      <TableCell>
                        {conversation.leadScore !== null ? (
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant={
                                conversation.leadQualificationStatus === "hot"
                                  ? "destructive"
                                  : conversation.leadQualificationStatus === "warm"
                                    ? "warning"
                                    : "secondary"
                              }
                            >
                              {conversation.leadScore}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={conversation.owner === "human" ? "secondary" : "outline"} className="capitalize">
                          {conversation.owner}
                          {conversation.takeoverReason === "automatic" ? " · escalated" : ""}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={conversation.status === "active" ? "secondary" : "outline"} className="capitalize">
                          {conversation.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {conversation.assignedUserId ? (emailByUserId.get(conversation.assignedUserId) ?? "—") : "Unassigned"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{conversation.lastActivityAt.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
