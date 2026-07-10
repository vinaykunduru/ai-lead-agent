import "server-only";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { memberships, organizations } from "@/db/schema";
import type { Role } from "@/modules/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CompanySession = {
  userId: string;
  organizationId: string;
  organizationStatus: "trial" | "active" | "suspended";
  role: Role;
};

/**
 * The only place a user's identity is trusted from. Reads the verified
 * Supabase session for the current request — never derived from anything
 * the client sent (a header, a body field, a URL param).
 */
export const getAuthenticatedUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
});

/**
 * Resolves the current user's company context: which organization, and
 * with what role. This is the only source of truth for `organizationId` in
 * the company dashboard — every service call downstream takes this, never a
 * value read from the request. The lookup itself runs inside an RLS-scoped
 * transaction (see CLAUDE.md §3.5), so even this resolution step is subject
 * to the same database-level tenant isolation as everything else.
 *
 * Returns null if the user has no active membership anywhere (not just "no
 * membership in the org they asked for" — this function never takes an org
 * id as input).
 */
export const getCompanySession = cache(async (): Promise<CompanySession | null> => {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const membership = await withRlsContext(user.id, async (tx) => {
    const [row] = await tx
      .select({
        organizationId: memberships.organizationId,
        role: memberships.role,
        organizationStatus: organizations.status,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(and(eq(memberships.userId, user.id), eq(memberships.status, "active")))
      .limit(1);
    return row ?? null;
  });

  if (!membership) return null;

  return {
    userId: user.id,
    organizationId: membership.organizationId,
    organizationStatus: membership.organizationStatus,
    role: membership.role,
  };
});

/**
 * For Server Actions and service functions, which should fail loudly rather
 * than redirect (redirects belong at the page/layout level — see
 * requireCompanySession usage in app/(app)/layout.tsx).
 */
export async function requireCompanySession(): Promise<CompanySession> {
  const session = await getCompanySession();
  if (!session) {
    throw new Error("Unauthorized: no active company membership");
  }
  return session;
}
