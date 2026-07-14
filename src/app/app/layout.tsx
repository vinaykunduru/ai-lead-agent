import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Inbox,
  MessagesSquare,
  BookOpen,
  Sparkles,
  MonitorSmartphone,
  UsersRound,
  Settings,
} from "lucide-react";
import { getAuthenticatedUser, getCompanySession } from "@/lib/auth/session";
import { hasSuspendedOrgMembership } from "@/lib/auth/suspended";
import { signOutAction } from "@/lib/auth/actions";
import { DashboardShell, type NavItem } from "@/shared/components/dashboard-shell";

const ICON_CLASS = "size-4 shrink-0";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/app", icon: <LayoutDashboard className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Analytics", href: "/app/analytics", icon: <BarChart3 className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Leads", href: "/app/leads", icon: <Users className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Inbox", href: "/app/inbox", icon: <Inbox className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Conversations", href: "/app/conversations", icon: <MessagesSquare className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Knowledge Base", href: "/app/knowledge-base", icon: <BookOpen className={ICON_CLASS} aria-hidden="true" /> },
  { label: "AI Behaviour", href: "/app/ai-behaviour", icon: <Sparkles className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Widget", href: "/app/widget", icon: <MonitorSmartphone className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Team", href: "/app/team", icon: <UsersRound className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Settings", href: "/app/settings", icon: <Settings className={ICON_CLASS} aria-hidden="true" /> },
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
      brand="Bloom"
      navItems={NAV_ITEMS}
      userLabel={user.email ?? "Account"}
      signOutAction={signOutAction}
    >
      {children}
    </DashboardShell>
  );
}
