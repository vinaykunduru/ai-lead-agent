import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { memberships, organizations } from "@/db/schema";

/**
 * Narrow, read-only, service-role check used only to pick which message the
 * login page shows — never to grant or return tenant data.
 *
 * Why this needs to bypass RLS: the RLS policies on `organizations` and
 * `memberships` (db/migrations/0001) both exclude suspended orgs entirely,
 * which is correct for data access but means an RLS-scoped query can't tell
 * "this user's company is suspended" apart from "this user has no company at
 * all" — getCompanySession() returns null either way. This is the one place
 * that distinction is resolved, and it returns a boolean only. This is a
 * fourth narrow service-role exception alongside the three in CLAUDE.md §3.6
 * — see the note there.
 */
export async function hasSuspendedOrgMembership(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.status, "active"),
        eq(organizations.status, "suspended"),
      ),
    )
    .limit(1);

  return Boolean(row);
}
