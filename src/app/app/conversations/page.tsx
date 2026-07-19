import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { listConversations } from "@/modules/conversation/inspector-service";
import { listWidgets } from "@/modules/widget/widgets-service";

export default async function ConversationsPage() {
  const session = await requireCompanySession();
  const canViewWidgets = can(session, "widget.view");

  const [conversations, widgets] = await Promise.all([
    listConversations(),
    canViewWidgets ? listWidgets() : Promise.resolve([]),
  ]);
  const hasActiveWidget = widgets.some((widget) => widget.status === "active");

  return (
    <div>
      <PageHeader
        title="Conversations"
        description="AI and visitor conversations — internal inspector, not customer-facing."
      />
      <div className="p-6">
        {conversations.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No conversations yet"
            description={
              hasActiveWidget
                ? "Every conversation your widget has with a visitor will show up here in real time — nothing to do but wait for the first one."
                : "Conversations appear here once a visitor sends a message through your widget. Publish a widget to start receiving them."
            }
            action={
              !hasActiveWidget && canViewWidgets ? (
                <Button size="sm" render={<Link href="/app/widget">Go to Widget</Link>} />
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Widget</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Last activity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((conversation) => (
                  <TableRow key={conversation.id}>
                    <TableCell>
                      <Link
                        href={`/app/conversations/${conversation.id}`}
                        className="font-medium hover:underline"
                      >
                        {conversation.widgetName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={conversation.status === "active" ? "secondary" : "outline"} className="capitalize">
                        {conversation.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{conversation.messageCount}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {conversation.lastActivityAt.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
