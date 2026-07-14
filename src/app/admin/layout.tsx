import { redirect } from "next/navigation";
import { LayoutDashboard, Building2, Users, BarChart3, ScrollText, Settings } from "lucide-react";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { signOutAction } from "@/lib/auth/actions";
import { DashboardShell, type NavItem } from "@/shared/components/dashboard-shell";

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Companies", href: "/admin/companies", icon: Building2 },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Usage", href: "/admin/usage", icon: BarChart3 },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
  { label: "Settings", href: "/admin/settings", icon: Settings },
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
