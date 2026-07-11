import "server-only";
import { eq } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { memberships } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AssignableTeamMember = {
  userId: string;
  email: string | null;
  role: string;
};

/**
 * Minimal, read-only, RLS-scoped "who can I assign this to" lookup for the
 * Leads/Inbox assignment UI (module spec §9/§6). Not a Team management
 * module — src/app/app/team stays an unbuilt placeholder; this exists only
 * because Assignments/"Assigned to Me" are impossible to render without
 * knowing who the org's active members are. Gated by the existing
 * `users.view` permission rather than a new one.
 */
export async function listAssignableTeamMembers(): Promise<AssignableTeamMember[]> {
  const session = await requireCompanySession();
  assertPermission(session, "users.view");

  const rows = await withRlsContext(session.userId, (tx) =>
    tx
      .select({ userId: memberships.userId, role: memberships.role })
      .from(memberships)
      .where(eq(memberships.organizationId, session.organizationId)),
  );
  if (rows.length === 0) return [];

  const supabaseAdmin = createSupabaseAdminClient();
  const emailByUserId = new Map<string, string | null>();
  await Promise.all(
    rows.map(async (row) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(row.userId);
      emailByUserId.set(row.userId, data.user?.email ?? null);
    }),
  );

  return rows.map((row) => ({
    userId: row.userId,
    role: row.role,
    email: emailByUserId.get(row.userId) ?? null,
  }));
}
