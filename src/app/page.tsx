import { redirect } from "next/navigation";
import { getAuthenticatedUser, getCompanySession } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { hasSuspendedOrgMembership } from "@/lib/auth/suspended";

/**
 * Resolves an authenticated visitor to the surface they belong to. Never
 * renders its own UI — every branch redirects. Platform admin status and
 * company membership are independent checks (see CLAUDE.md §3.7), so a user
 * could in principle be neither; that case sends them back to login rather
 * than guessing.
 */
export default async function RootPage() {
  if (await isPlatformAdmin()) {
    redirect("/admin");
  }

  const companySession = await getCompanySession();
  if (companySession) {
    redirect("/app");
  }

  // See src/app/app/layout.tsx for why this extra check exists: RLS makes
  // "suspended" and "no membership" indistinguishable from getCompanySession()
  // alone.
  const user = await getAuthenticatedUser();
  if (user && (await hasSuspendedOrgMembership(user.id))) {
    redirect("/login?notice=suspended");
  }

  redirect("/login");
}
