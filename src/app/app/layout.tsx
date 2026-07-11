import { redirect } from "next/navigation";
import { getAuthenticatedUser, getCompanySession } from "@/lib/auth/session";
import { hasSuspendedOrgMembership } from "@/lib/auth/suspended";
import { signOutAction } from "@/lib/auth/actions";
import { DashboardShell, type NavItem } from "@/shared/components/dashboard-shell";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/app" },
  { label: "Analytics", href: "/app/analytics" },
  { label: "Leads", href: "/app/leads" },
  { label: "Inbox", href: "/app/inbox" },
  { label: "Conversations", href: "/app/conversations" },
  { label: "Knowledge Base", href: "/app/knowledge-base" },
  { label: "AI Behaviour", href: "/app/ai-behaviour" },
  { label: "Widget", href: "/app/widget" },
  { label: "Team", href: "/app/team" },
  { label: "Settings", href: "/app/settings" },
];

export default async function CompanyAppLayout({ children }: { children: React.ReactNode }) {
  const [user, session] = await Promise.all([getAuthenticatedUser(), getCompanySession()]);

  if (!user) {
    redirect("/login");
  }
  if (!session) {
    // getCompanySession() returns null both for "no membership at all" and
    // for "membership exists but the org is suspended" — RLS excludes
    // suspended orgs from the query entirely (correct for data access), so
    // the two cases are indistinguishable from that query alone. Resolve
    // which one this is only to pick the right message; this check never
    // grants access — see lib/auth/suspended.ts.
    const suspended = await hasSuspendedOrgMembership(user.id);
    redirect(suspended ? "/login?notice=suspended" : "/login");
  }

  return (
    <DashboardShell
      brand="AI Lead Agent"
      navItems={NAV_ITEMS}
      userLabel={user.email ?? "Account"}
      signOutAction={signOutAction}
    >
      {children}
    </DashboardShell>
  );
}
