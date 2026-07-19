import Link from "next/link";
import {
  Users,
  MessagesSquare,
  Bot,
  BookOpen,
  MonitorSmartphone,
  BarChart3,
  ArrowRight,
  UserCircle,
  Building2,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { StatTile } from "@/app/app/analytics/charts/stat-tile";
import { getCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { getMyOrganization } from "@/modules/organizations/service";
import { getExecutiveDashboard } from "@/modules/analytics/executive-service";
import { getLeadDashboardMetrics } from "@/modules/leads/dashboard-service";
import { listLeads } from "@/modules/leads/leads-service";
import { listWidgets } from "@/modules/widget/widgets-service";
import { listDocuments } from "@/modules/knowledge/documents-service";
import { getAiProfile } from "@/modules/ai-behaviour/profile-service";
import { getOnboardingStatus, type OnboardingStatus } from "@/modules/onboarding/status";
import { WelcomeScreen } from "@/shared/components/welcome-screen";
import { SetupChecklistCard } from "@/shared/components/setup-checklist-card";
import { FirstSuccessBanner } from "@/shared/components/first-success-banner";
import type { Lead, Widget, AiProfile } from "@/db/schema";
import type { PublicKnowledgeDocument } from "@/modules/knowledge/documents-service";

const QUICK_ACTIONS = [
  { label: "Leads", description: "Track and qualify visitors", href: "/app/leads", icon: Users, permission: "leads.view" },
  { label: "Conversations", description: "Review AI conversations", href: "/app/conversations", icon: MessagesSquare, permission: "conversations.view" },
  { label: "Knowledge Base", description: "Train your AI agent", href: "/app/knowledge-base", icon: BookOpen, permission: "knowledge.view" },
  { label: "Widget", description: "Manage embedded widgets", href: "/app/widget", icon: MonitorSmartphone, permission: "widget.view" },
  { label: "AI Behaviour", description: "Configure how BloomAI responds", href: "/app/ai-behaviour", icon: Bot, permission: "ai.view" },
  { label: "Analytics", description: "Deep-dive into performance", href: "/app/analytics", icon: BarChart3, permission: "analytics.view" },
] as const;

function scoreBadgeVariant(score: number) {
  if (score >= 70) return "default" as const;
  if (score >= 40) return "secondary" as const;
  return "outline" as const;
}

function startOfTodayIso(): string {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

export default async function CompanyDashboardPage() {
  const [session, organization] = await Promise.all([getCompanySession(), getMyOrganization()]);

  const canViewAnalytics = session ? can(session, "analytics.view") : false;
  const canViewLeads = session ? can(session, "leads.view") : false;
  const canCreateLeads = session ? can(session, "leads.create") : false;
  const canConfigure = session ? can(session, "ai.update") : false;
  const canViewAi = session ? can(session, "ai.view") : false;
  const canViewWidgets = session ? can(session, "widget.view") : false;
  const canViewKnowledge = session ? can(session, "knowledge.view") : false;

  const [summary, todaySummary, leadMetrics, recentLeads, onboarding, aiProfile, widgets, documents] =
    await Promise.all([
      canViewAnalytics ? getExecutiveDashboard({}) : Promise.resolve(null),
      canViewAnalytics ? getExecutiveDashboard({ from: startOfTodayIso() }) : Promise.resolve(null),
      canViewLeads ? getLeadDashboardMetrics() : Promise.resolve(null),
      canViewLeads ? listLeads({ limit: 5 }) : Promise.resolve([] as Lead[]),
      canConfigure ? getOnboardingStatus() : Promise.resolve(null),
      canViewAi ? getAiProfile() : Promise.resolve(null),
      canViewWidgets ? listWidgets() : Promise.resolve([] as Widget[]),
      canViewKnowledge ? listDocuments() : Promise.resolve([] as PublicKnowledgeDocument[]),
    ]);

  const visibleActions = QUICK_ACTIONS.filter((action) => !session || can(session, action.permission));

  const coreSteps = onboarding?.steps.filter((step) => ["ai", "knowledge", "widget"].includes(step.id));
  const isBrandNew = Boolean(coreSteps && coreSteps.length > 0 && coreSteps.every((step) => !step.complete));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={isBrandNew ? "Let's get your AI agent live." : `Welcome to ${organization.name}.`}
      />

      {isBrandNew && session ? (
        <WelcomeScreen organizationId={session.organizationId} organizationName={organization.name}>
          <DashboardBody
            summary={summary}
            todaySummary={todaySummary}
            leadMetrics={leadMetrics}
            visibleActions={visibleActions}
            canViewLeads={canViewLeads}
            canCreateLeads={canCreateLeads}
            canViewAi={canViewAi}
            canViewWidgets={canViewWidgets}
            canViewKnowledge={canViewKnowledge}
            recentLeads={recentLeads}
            session={session}
            organization={organization}
            onboarding={onboarding}
            aiProfile={aiProfile}
            widgets={widgets}
            documents={documents}
          />
        </WelcomeScreen>
      ) : (
        <DashboardBody
          summary={summary}
          todaySummary={todaySummary}
          leadMetrics={leadMetrics}
          visibleActions={visibleActions}
          canViewLeads={canViewLeads}
          canCreateLeads={canCreateLeads}
          canViewAi={canViewAi}
          canViewWidgets={canViewWidgets}
          canViewKnowledge={canViewKnowledge}
          recentLeads={recentLeads}
          session={session}
          organization={organization}
          onboarding={onboarding}
          aiProfile={aiProfile}
          widgets={widgets}
          documents={documents}
        />
      )}
    </div>
  );
}

type StatusTone = "default" | "success" | "warning" | "outline" | "secondary";

function StatusCard({
  icon: Icon,
  title,
  status,
  tone,
  detail,
  href,
}: {
  icon: LucideIcon;
  title: string;
  status: string;
  tone: StatusTone;
  detail: string;
  href: string;
}) {
  return (
    <Card interactive className="group">
      <Link href={href} className="block focus-visible:outline-none">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-caption text-muted-foreground">
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {title}
            </div>
            <ArrowRight
              className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={tone}>{status}</Badge>
          </div>
          <p className="mt-2 text-caption text-muted-foreground">{detail}</p>
        </CardContent>
      </Link>
    </Card>
  );
}

function aiHealth(profile: AiProfile | null, summary: DashboardBodyProps["summary"]) {
  if (!profile || profile.updatedAt.getTime() === profile.createdAt.getTime()) {
    return { status: "Not configured", tone: "outline" as StatusTone, detail: "Give your AI a personality and rules to get started." };
  }
  if (!summary || summary.totalConversations === 0) {
    return { status: "Ready", tone: "secondary" as StatusTone, detail: "Configured and waiting for its first conversation." };
  }
  if (summary.aiResolutionRate >= 60) {
    return {
      status: "Healthy",
      tone: "success" as StatusTone,
      detail: `${summary.aiResolutionRate}% of conversations resolved without a human.`,
    };
  }
  return {
    status: "Needs attention",
    tone: "warning" as StatusTone,
    detail: `Only ${summary.aiResolutionRate}% resolved without a human — ${summary.humanTakeovers} handed off.`,
  };
}

function widgetHealth(widgets: Widget[]) {
  if (widgets.length === 0) {
    return { status: "Not created", tone: "outline" as StatusTone, detail: "Create a widget to get your install snippet." };
  }
  const active = widgets.filter((w) => w.status === "active").length;
  if (active === 0) {
    return {
      status: "Draft",
      tone: "warning" as StatusTone,
      detail: `${widgets.length} widget${widgets.length === 1 ? "" : "s"} created, none published yet.`,
    };
  }
  return {
    status: "Live",
    tone: "success" as StatusTone,
    detail: `${active} of ${widgets.length} widget${widgets.length === 1 ? "" : "s"} published.`,
  };
}

function knowledgeHealth(documents: PublicKnowledgeDocument[]) {
  if (documents.length === 0) {
    return { status: "Empty", tone: "outline" as StatusTone, detail: "Add documents so your AI has something to answer from." };
  }
  const failed = documents.filter((d) => d.status === "failed").length;
  if (failed > 0) {
    return {
      status: "Needs attention",
      tone: "warning" as StatusTone,
      detail: `${failed} document${failed === 1 ? "" : "s"} failed to process.`,
    };
  }
  const processing = documents.filter((d) => d.status === "pending" || d.status === "processing").length;
  if (processing > 0) {
    return {
      status: "Processing",
      tone: "secondary" as StatusTone,
      detail: `${processing} document${processing === 1 ? "" : "s"} still being indexed.`,
    };
  }
  const totalChunks = documents.reduce((sum, d) => sum + d.chunkCount, 0);
  return {
    status: "Ready",
    tone: "success" as StatusTone,
    detail: `${documents.length} document${documents.length === 1 ? "" : "s"}, ${totalChunks} chunks indexed.`,
  };
}

type DashboardBodyProps = {
  summary: Awaited<ReturnType<typeof getExecutiveDashboard>> | null;
  todaySummary: Awaited<ReturnType<typeof getExecutiveDashboard>> | null;
  leadMetrics: Awaited<ReturnType<typeof getLeadDashboardMetrics>> | null;
  visibleActions: typeof QUICK_ACTIONS extends readonly (infer T)[] ? T[] : never;
  canViewLeads: boolean;
  canCreateLeads: boolean;
  canViewAi: boolean;
  canViewWidgets: boolean;
  canViewKnowledge: boolean;
  recentLeads: Lead[];
  session: Awaited<ReturnType<typeof getCompanySession>>;
  organization: Awaited<ReturnType<typeof getMyOrganization>>;
  onboarding: OnboardingStatus | null;
  aiProfile: AiProfile | null;
  widgets: Widget[];
  documents: PublicKnowledgeDocument[];
};

function DashboardBody({
  summary,
  todaySummary,
  leadMetrics,
  visibleActions,
  canViewLeads,
  canCreateLeads,
  canViewAi,
  canViewWidgets,
  canViewKnowledge,
  recentLeads,
  session,
  organization,
  onboarding,
  aiProfile,
  widgets,
  documents,
}: DashboardBodyProps) {
  const showStatusRow = canViewAi || canViewWidgets || canViewKnowledge;
  const ai = aiHealth(aiProfile, summary);
  const widget = widgetHealth(widgets);
  const knowledge = knowledgeHealth(documents);

  return (
      <div className="space-y-8 p-6">
        {onboarding && session ? (
          onboarding.allComplete ? (
            <FirstSuccessBanner organizationId={session.organizationId} status={onboarding} />
          ) : (
            <SetupChecklistCard organizationId={session.organizationId} status={onboarding} />
          )
        ) : null}

        {showStatusRow ? (
          <section aria-labelledby="dashboard-status-heading">
            <h2 id="dashboard-status-heading" className="mb-3 text-section font-semibold tracking-tight">
              System status
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {canViewAi ? (
                <StatusCard icon={Bot} title="AI" status={ai.status} tone={ai.tone} detail={ai.detail} href="/app/ai-behaviour" />
              ) : null}
              {canViewKnowledge ? (
                <StatusCard
                  icon={BookOpen}
                  title="Knowledge"
                  status={knowledge.status}
                  tone={knowledge.tone}
                  detail={knowledge.detail}
                  href="/app/knowledge-base"
                />
              ) : null}
              {canViewWidgets ? (
                <StatusCard
                  icon={MonitorSmartphone}
                  title="Widget"
                  status={widget.status}
                  tone={widget.tone}
                  detail={widget.detail}
                  href="/app/widget"
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {summary ? (
          <section aria-labelledby="dashboard-overview-heading">
            <h2 id="dashboard-overview-heading" className="mb-3 text-section font-semibold tracking-tight">
              Today
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Conversations today" value={todaySummary?.totalConversations ?? 0} />
              <StatTile label="Active now" value={summary.activeConversations} />
              <StatTile label="Leads generated" value={summary.leadsGenerated} hint="All time" />
              <StatTile label="AI resolution rate" value={summary.aiResolutionRate} suffix="%" hint="All time" />
            </div>
          </section>
        ) : null}

        {leadMetrics ? (
          <section aria-labelledby="dashboard-leads-heading">
            <h2 id="dashboard-leads-heading" className="mb-3 text-section font-semibold tracking-tight">
              Lead summary
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="New leads" value={leadMetrics.newLeads} hint="Last 30 days" />
              <StatTile label="Qualified" value={leadMetrics.qualifiedLeads} />
              <StatTile label="Conversion rate" value={leadMetrics.conversionRate} suffix="%" />
              <StatTile label="Won" value={leadMetrics.won} />
            </div>
          </section>
        ) : null}

        {canViewLeads ? (
          <section aria-labelledby="dashboard-recent-leads-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="dashboard-recent-leads-heading" className="text-section font-semibold tracking-tight">
                Recent leads
              </h2>
              <Button variant="ghost" size="sm" render={<Link href="/app/leads">View all</Link>} />
            </div>
            {recentLeads.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No leads yet"
                description="Leads captured from your website widget will show up here as visitors chat with your AI agent."
                action={
                  canCreateLeads ? (
                    <Button size="sm" render={<Link href="/app/leads">Go to Leads</Link>} />
                  ) : undefined
                }
              />
            ) : (
              <div className="overflow-hidden rounded-xl border bg-card shadow-card">
                <ul className="divide-y">
                  {recentLeads.map((lead) => (
                    <li key={lead.id}>
                      <Link
                        href={`/app/leads/${lead.id}`}
                        className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {lead.name || lead.email || lead.phone || "Unnamed lead"}
                          </span>
                          <span className="block truncate text-caption text-muted-foreground">
                            {lead.company || "—"}
                          </span>
                        </span>
                        <Badge variant={scoreBadgeVariant(lead.score)}>Score: {lead.score}</Badge>
                        <span className="hidden shrink-0 text-caption text-muted-foreground sm:block">
                          {lead.lastActivityAt.toLocaleDateString()}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ) : null}

        {visibleActions.length > 0 ? (
          <section aria-labelledby="dashboard-quick-actions-heading">
            <h2 id="dashboard-quick-actions-heading" className="mb-3 text-section font-semibold tracking-tight">
              Quick actions
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleActions.map((action) => (
                <Card key={action.href} interactive className="group">
                  <Link href={action.href} className="block focus-visible:outline-none">
                    <CardContent className="flex items-center gap-3 pt-6">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <action.icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{action.label}</span>
                        <span className="block truncate text-caption text-muted-foreground">
                          {action.description}
                        </span>
                      </span>
                      <ArrowRight
                        className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        <section aria-labelledby="dashboard-account-heading">
          <h2 id="dashboard-account-heading" className="mb-3 text-section font-semibold tracking-tight">
            Account
          </h2>
          <Card>
            <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-3">
              <div className="flex items-center gap-2.5">
                <UserCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-caption text-muted-foreground">Your role</p>
                  <p className="truncate text-sm font-medium capitalize">{session?.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-caption text-muted-foreground">Company status</p>
                  <p className="truncate text-sm font-medium capitalize">{organization.status}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-caption text-muted-foreground">Timezone</p>
                  <p className="truncate text-sm font-medium">{organization.timezone}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
  );
}
