import Link from "next/link";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listConversations } from "@/modules/conversation/inspector-service";

export default async function ConversationsPage() {
  const conversations = await listConversations();

  return (
    <div>
      <PageHeader
        title="Conversations"
        description="AI and visitor conversations — internal inspector, not customer-facing."
      />
      <div className="p-6">
        {conversations.length === 0 ? (
          <EmptyState
            title="No conversations yet"
            description="Conversations appear here once a visitor sends a message through one of your widgets."
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
