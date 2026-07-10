import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { signOutAction } from "@/lib/auth/actions";
import { DashboardShell, type NavItem } from "@/shared/components/dashboard-shell";

const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/admin" },
  { label: "Companies", href: "/admin/companies" },
  { label: "Users", href: "/admin/users" },
  { label: "Usage", href: "/admin/usage" },
  { label: "Audit Logs", href: "/admin/audit-logs" },
  { label: "Settings", href: "/admin/settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();
  const admin = user ? await isPlatformAdmin() : false;

  if (!user || !admin) {
    redirect("/login");
  }

  return (
    <DashboardShell
      brand="Platform Admin"
      navItems={NAV_ITEMS}
      userLabel={user.email ?? "Admin"}
      signOutAction={signOutAction}
    >
      {children}
    </DashboardShell>
  );
}
