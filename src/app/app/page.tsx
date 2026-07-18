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
import { listLeads } from "@/modules/leads/leads-service";
import type { Lead } from "@/db/schema";

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

export default async function CompanyDashboardPage() {
  const [session, organization] = await Promise.all([getCompanySession(), getMyOrganization()]);

  const canViewAnalytics = session ? can(session, "analytics.view") : false;
  const canViewLeads = session ? can(session, "leads.view") : false;
  const canCreateLeads = session ? can(session, "leads.create") : false;

  const [summary, recentLeads] = await Promise.all([
    canViewAnalytics ? getExecutiveDashboard({}) : Promise.resolve(null),
    canViewLeads ? listLeads({ limit: 5 }) : Promise.resolve([] as Lead[]),
  ]);

  const visibleActions = QUICK_ACTIONS.filter((action) => !session || can(session, action.permission));

  return (
    <div>
      <PageHeader title="Dashboard" description={`Welcome to ${organization.name}.`} />

      <div className="space-y-8 p-6">
        {summary ? (
          <section aria-labelledby="dashboard-overview-heading">
            <h2 id="dashboard-overview-heading" className="mb-3 text-section font-semibold tracking-tight">
              Overview
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Total conversations" value={summary.totalConversations} />
              <StatTile label="Active now" value={summary.activeConversations} />
              <StatTile label="Leads generated" value={summary.leadsGenerated} />
              <StatTile label="AI resolution rate" value={summary.aiResolutionRate} suffix="%" />
            </div>
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
    </div>
  );
}
