import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/shared/components/page-header";
import { BackLink } from "@/shared/components/back-link";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { getConversationDetail } from "@/modules/conversation/inspector-service";
import { loadAiBehaviourForConversation } from "@/modules/ai-behaviour/conversation-config";
import { generateSystemPrompt } from "@/modules/ai-behaviour/prompt-generator";
import { renderStructuredPrompt } from "@/modules/ai-behaviour/rendering";
import { getVisitorContextForConversation } from "@/modules/visitor-profiles/service";
import { VisitorInfoCard } from "@/shared/components/visitor-info-card";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending: "secondary",
  streaming: "outline",
  complete: "success",
  error: "destructive",
};

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  if (!z.string().uuid().safeParse(conversationId).success) {
    notFound();
  }

  const session = await requireCompanySession();
  assertPermission(session, "conversations.view");

  const detail = await getConversationDetail(conversationId);
  if (!detail.conversation) {
    notFound();
  }

  // Live preview only — reflects the organization's *current* AI Behaviour
  // configuration, not necessarily what was in effect when each message
  // below was generated (the actual rendered prompt text sent to the
  // provider is never persisted — see modules/conversation's design notes;
  // only references to what informed a reply are stored, via citations).
  const behaviourConfig = await loadAiBehaviourForConversation(detail.conversation.organizationId);
  const structuredPrompt = generateSystemPrompt(behaviourConfig);
  const renderedPrompt = renderStructuredPrompt(behaviourConfig.profile.aiProvider, structuredPrompt);
  const visitorContext = await getVisitorContextForConversation(conversationId);

  return (
    <div>
      <div className="border-b px-6 pt-5">
        <BackLink href="/app/conversations" label="Conversations" />
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

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[minmax(320px,2fr)_minmax(280px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.messages.map((message) => {
              const citations = detail.citationsByMessageId[message.id] ?? [];
              const usage = detail.usageByMessageId[message.id];
              return (
                <div key={message.id} className="rounded-md border p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="capitalize">
                      {message.role}
                    </Badge>
                    <Badge variant={STATUS_VARIANTS[message.status] ?? "secondary"} className="capitalize">
                      {message.status}
                    </Badge>
                    <span>{message.createdAt.toLocaleString()}</span>
                    {message.provider ? <span>· {message.provider}</span> : null}
                    {message.model ? <span>· {message.model}</span> : null}
                    {message.latencyMs !== null ? <span>· {message.latencyMs}ms</span> : null}
                    {message.promptTokens !== null && message.completionTokens !== null ? (
                      <span>
                        · {message.promptTokens}+{message.completionTokens} tokens
                      </span>
                    ) : null}
                    {usage ? <span>· ~${Number(usage.estimatedCostUsd).toFixed(4)}</span> : null}
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{message.content || <em>(empty)</em>}</p>
                  {message.errorMessage ? (
                    <p className="mt-2 text-xs text-destructive">{message.errorMessage}</p>
                  ) : null}
                  {citations.length > 0 ? (
                    <div className="mt-3 space-y-1 border-t pt-2">
                      <p className="text-xs font-medium text-muted-foreground">Retrieved chunks</p>
                      {citations.map((citation) => (
                        <div key={citation.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="capitalize">
                            {citation.confidence}
                          </Badge>
                          <span>{citation.similarity.toFixed(3)} similarity</span>
                          <span className="font-mono text-[11px]">chunk {citation.chunkId.slice(0, 8)}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {visitorContext ? (
            <VisitorInfoCard
              profile={visitorContext.profile}
              lead={visitorContext.lead}
              viewHref={`/app/visitors/${visitorContext.profile.id}`}
            />
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current structured prompt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(structuredPrompt, null, 2)}
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current rendered prompt ({behaviourConfig.profile.aiProvider})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
                {renderedPrompt}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
