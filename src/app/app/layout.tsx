import { redirect } from "next/navigation";
import { getAuthenticatedUser, getCompanySession } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { DashboardShell, type NavItem } from "@/shared/components/dashboard-shell";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/app" },
  { label: "Leads", href: "/app/leads" },
  { label: "Conversations", href: "/app/conversations" },
  { label: "Knowledge Base", href: "/app/knowledge-base" },
  { label: "AI Behaviour", href: "/app/ai-behaviour" },
  { label: "Widget", href: "/app/widget" },
  { label: "Team", href: "/app/team" },
  { label: "Settings", href: "/app/settings" },
];

export default async function CompanyAppLayout({ children }: { children: React.ReactNode }) {
  const [user, session] = await Promise.all([getAuthenticatedUser(), getCompanySession()]);

  if (!user || !session) {
    redirect("/login");
  }
  // Defense in depth: RLS also blocks suspended-org reads (see
  // db/migrations/0001), this is the app-layer half of that same check.
  if (session.organizationStatus === "suspended") {
    redirect("/login?suspended=1");
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
