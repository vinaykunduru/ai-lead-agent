import { redirect } from "next/navigation";
import { getCompanySession } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";

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

  redirect("/login");
}
