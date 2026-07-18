import Link from "next/link";
import { Building2, CheckCircle2, Hourglass, ShieldAlert, Users, ScrollText, Settings, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/shared/components/page-header";
import { getPlatformOverview } from "@/modules/organizations/service";

const QUICK_ACTIONS = [
  { label: "Companies", description: "Manage tenant organizations", href: "/admin/companies", icon: Building2 },
  { label: "Users", description: "Cross-tenant user directory", href: "/admin/users", icon: Users },
  { label: "Audit Logs", description: "Review platform activity", href: "/admin/audit-logs", icon: ScrollText },
  { label: "Settings", description: "Platform-wide configuration", href: "/admin/settings", icon: Settings },
] as const;

export default async function AdminOverviewPage() {
  const stats = await getPlatformOverview();

  const cards = [
    { label: "Total companies", value: stats.totalCompanies, icon: Building2 },
    { label: "Trial", value: stats.trialCompanies, icon: Hourglass },
    { label: "Active", value: stats.activeCompanies, icon: CheckCircle2 },
    { label: "Suspended", value: stats.suspendedCompanies, icon: ShieldAlert },
    { label: "Company users", value: stats.totalCompanyUsers, icon: Users },
  ];

  return (
    <div>
      <PageHeader title="Overview" description="Platform-wide snapshot." />
      <div className="space-y-8 p-6">
        <section aria-labelledby="admin-overview-heading">
          <h2 id="admin-overview-heading" className="mb-3 text-section font-semibold tracking-tight">
            Overview
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {cards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {card.label}
                  </CardTitle>
                  <card.icon className="size-4 text-primary" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <p className="text-metric font-semibold">{card.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="admin-quick-actions-heading">
          <h2 id="admin-quick-actions-heading" className="mb-3 text-section font-semibold tracking-tight">
            Quick actions
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_ACTIONS.map((action) => (
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
      </div>
    </div>
  );
}
