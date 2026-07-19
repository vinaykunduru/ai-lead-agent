import Link from "next/link";
import { Bot, MonitorSmartphone, UsersRound, GitBranch, Building2, ArrowRight } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";

const SETTINGS_MAP = [
  {
    label: "AI behaviour",
    description: "Personality, response style, business hours, and handoff rules.",
    href: "/app/ai-behaviour",
    icon: Bot,
    permission: "ai.view",
  },
  {
    label: "Widget",
    description: "Appearance, install scripts, and allowed domains.",
    href: "/app/widget",
    icon: MonitorSmartphone,
    permission: "widget.view",
  },
  {
    label: "Lead pipeline",
    description: "Stages your leads move through, from new to won or lost.",
    href: "/app/leads",
    icon: GitBranch,
    permission: "leads.view",
  },
  {
    label: "Team",
    description: "Who has access to this workspace and what role they have.",
    href: "/app/team",
    icon: UsersRound,
    permission: "users.view",
  },
] as const;

export default async function CompanySettingsPage() {
  const session = await requireCompanySession();
  const availableSettings = SETTINGS_MAP.filter((item) => can(session, item.permission));

  return (
    <div>
      <PageHeader title="Settings" description="Company-wide configuration, organized by what it controls." />
      <div className="p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {availableSettings.map((item) => (
            <Card key={item.href} interactive className="group">
              <Link href={item.href} className="block focus-visible:outline-none">
                <CardContent className="flex items-center gap-3 pt-6">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="block truncate text-caption text-muted-foreground">{item.description}</span>
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

        <div className="mt-6 flex items-start gap-3 rounded-lg border border-dashed p-4">
          <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-caption text-muted-foreground">
            Company profile — name, logo, and industry — is managed by your platform administrator, not from
            here.
          </p>
        </div>
      </div>
    </div>
  );
}
