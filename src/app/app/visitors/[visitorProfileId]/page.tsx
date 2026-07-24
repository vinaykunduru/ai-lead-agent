import { notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { PageHeader } from "@/shared/components/page-header";
import { BackLink } from "@/shared/components/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import {
  getVisitorProfile,
  listVisitorProfileConversations,
  listVisitorProfileLeads,
} from "@/modules/visitor-profiles/service";
import { PriorityBadge, QualificationBadge, ScoreBadge } from "@/shared/components/lead-badges";
import { VisitorProfileForm } from "./visitor-profile-form";

const AI_FIELDS: { key: "intent" | "sentiment" | "conversationSummary" | "nextRecommendedAction"; label: string }[] = [
  { key: "intent", label: "Intent" },
  { key: "sentiment", label: "Sentiment" },
  { key: "conversationSummary", label: "Conversation summary" },
  { key: "nextRecommendedAction", label: "Next recommended action" },
];

export default async function VisitorProfilePage({
  params,
}: {
  params: Promise<{ visitorProfileId: string }>;
}) {
  const { visitorProfileId } = await params;
  if (!z.string().uuid().safeParse(visitorProfileId).success) {
    notFound();
  }

  const session = await requireCompanySession();
  const profile = await getVisitorProfile(visitorProfileId);
  if (!profile) {
    notFound();
  }

  const [leads, conversations] = await Promise.all([
    listVisitorProfileLeads(visitorProfileId),
    can(session, "conversations.view") ? listVisitorProfileConversations(visitorProfileId) : Promise.resolve([]),
  ]);

  const knownAiFields = AI_FIELDS.filter((field) => Boolean(profile[field.key]));

  return (
    <div>
      <div className="border-b px-6 pt-5">
        <BackLink href="/app/leads" label="Leads" />
      </div>
      <PageHeader
        title={profile.name ?? profile.email ?? profile.phone ?? "Unknown visitor"}
        description={[profile.company, profile.email, profile.phone].filter(Boolean).join(" · ") || "No contact details captured yet"}
      />

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[minmax(320px,2fr)_minmax(280px,1fr)]">
        <div className="space-y-4">
          <VisitorProfileForm profile={profile} canUpdate={can(session, "leads.update")} />

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">AI-generated context</CardTitle>
            </CardHeader>
            <CardContent>
              {knownAiFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No AI-generated context yet — this fills in automatically as the visitor converses.
                </p>
              ) : (
                <dl className="space-y-3 text-sm">
                  {knownAiFields.map((field) => (
                    <div key={field.key}>
                      <dt className="text-caption text-muted-foreground">{field.label}</dt>
                      <dd className="capitalize">{profile[field.key]}</dd>
                    </div>
                  ))}
                  {profile.lastExtractedAt ? (
                    <div>
                      <dt className="text-caption text-muted-foreground">Last analyzed</dt>
                      <dd>{profile.lastExtractedAt.toLocaleString()}</dd>
                    </div>
                  ) : null}
                </dl>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Leads ({leads.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {leads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No leads for this visitor yet.</p>
              ) : (
                leads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/app/leads/${lead.id}`}
                    className="block rounded-md border p-2.5 hover:bg-accent/50"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PriorityBadge priority={lead.priority} />
                      <ScoreBadge score={lead.score} />
                      <QualificationBadge status={lead.qualificationStatus} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {lead.source} · {lead.lastActivityAt.toLocaleString()}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Conversations ({conversations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No conversations for this visitor yet.</p>
              ) : (
                conversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/app/conversations/${conversation.id}`}
                    className="block rounded-md border p-2.5 hover:bg-accent/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{conversation.widgetName}</span>
                      <Badge variant={conversation.status === "active" ? "secondary" : "outline"} className="capitalize">
                        {conversation.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {conversation.lastActivityAt.toLocaleString()}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
