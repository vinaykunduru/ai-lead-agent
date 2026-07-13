import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/shared/components/page-header";
import { BackLink } from "@/shared/components/back-link";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { getInboxConversation } from "@/modules/inbox/inbox-service";
import { InboxActions } from "./inbox-actions";

export default async function InboxConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  if (!z.string().uuid().safeParse(conversationId).success) {
    notFound();
  }

  const session = await requireCompanySession();
  const detail = await getInboxConversation(conversationId);
  if (!detail.conversation) {
    notFound();
  }

  return (
    <div>
      <div className="border-b px-6 pt-5">
        <BackLink href="/app/inbox" label="Inbox" />
      </div>
      <PageHeader
        title={detail.conversation.widgetName}
        description={`Started ${detail.conversation.startedAt.toLocaleString()}`}
        actions={
          <Badge variant={detail.conversation.status === "active" ? "secondary" : "outline"} className="capitalize">
            {detail.conversation.status}
          </Badge>
        }
      />
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Transcript</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[60vh] space-y-3 overflow-y-auto">
            {detail.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            ) : (
              detail.messages.map((message) => (
                <div key={message.id} className="rounded-md border p-2.5">
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="capitalize">
                      {message.role === "assistant" && !message.provider ? "human agent" : message.role}
                    </Badge>
                    <span>{message.createdAt.toLocaleString()}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{message.content || <em>(empty)</em>}</p>
                </div>
              ))
            )}
          </CardContent>
          <InboxActions conversation={detail.conversation} canReply={can(session, "inbox.reply")} />
        </Card>
      </div>
    </div>
  );
}
