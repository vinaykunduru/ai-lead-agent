import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConversationDetail } from "@/modules/conversation/inspector-service";

/**
 * Read-only transcript for the Lead Detail page — deliberately just the
 * message thread, not the AI Behaviour / structured-prompt panels the
 * Conversation Inspector shows (that stays internal-developer-only at
 * /app/conversations). Human-authored replies are distinguishable here the
 * same way modules/inbox/reply-service.ts stores them: provider/model null.
 */
export function LeadConversationPanel({ detail }: { detail: ConversationDetail | null }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">Conversation</CardTitle>
        {detail?.conversation ? (
          <Link href={`/app/inbox/${detail.conversation.id}`} className="text-xs text-primary hover:underline">
            Open in Inbox →
          </Link>
        ) : null}
      </CardHeader>
      <CardContent>
        {!detail?.conversation ? (
          <p className="text-sm text-muted-foreground">This lead has no linked conversation.</p>
        ) : (
          <div className="max-h-96 space-y-3 overflow-y-auto">
            {detail.messages.map((message) => (
              <div key={message.id} className="rounded-md border p-2.5">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="capitalize">
                    {message.role === "assistant" && !message.provider ? "human agent" : message.role}
                  </Badge>
                  <span>{message.createdAt.toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{message.content || <em>(empty)</em>}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
