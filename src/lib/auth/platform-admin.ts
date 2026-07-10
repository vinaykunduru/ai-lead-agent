import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { platformAdmins } from "@/db/schema";
import { getAuthenticatedUser } from "./session";

/**
 * Platform admin status is deliberately checked via the service-role client,
 * not withRlsContext — the `platform_admins` table has no RLS policy for the
 * "authenticated" role at all (see db/migrations/0001), so an RLS-scoped
 * query would always return zero rows. This is one of the three explicit,
 * documented service-role call sites in CLAUDE.md §3.6.
 *
 * Being a platform admin is structurally separate from being a member of any
 * organization (see CLAUDE.md §3.7) — this check never touches memberships.
 */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const user = await getAuthenticatedUser();
  if (!user) return false;

  const [row] = await db
    .select({ id: platformAdmins.id })
    .from(platformAdmins)
    .where(eq(platformAdmins.userId, user.id))
    .limit(1);

  return Boolean(row);
});

/** For Server Actions and service functions — throws instead of redirecting. */
export async function requirePlatformAdmin(): Promise<{ userId: string }> {
  const user = await getAuthenticatedUser();
  if (!user || !(await isPlatformAdmin())) {
    throw new Error("Forbidden: platform admin required");
  }
  return { userId: user.id };
}
