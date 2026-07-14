import { redirect } from "next/navigation";
import { LayoutDashboard, Building2, Users, BarChart3, ScrollText, Settings } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { signOutAction } from "@/lib/auth/actions";
import { DashboardShell, type NavItem } from "@/shared/components/dashboard-shell";

const ICON_CLASS = "size-4 shrink-0";

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/admin", icon: <LayoutDashboard className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Companies", href: "/admin/companies", icon: <Building2 className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Users", href: "/admin/users", icon: <Users className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Usage", href: "/admin/usage", icon: <BarChart3 className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: <ScrollText className={ICON_CLASS} aria-hidden="true" /> },
  { label: "Settings", href: "/admin/settings", icon: <Settings className={ICON_CLASS} aria-hidden="true" /> },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();
  const admin = user ? await isPlatformAdmin() : false;

  if (!user || !admin) {
    redirect("/login");
  }

  return (
    <DashboardShell
      brand="Bloom — Platform Admin"
      badge="Admin"
      navItems={NAV_ITEMS}
      userLabel={user.email ?? "Admin"}
      signOutAction={signOutAction}
    >
      {children}
    </DashboardShell>
  );
}
