import "server-only";
import { and, eq } from "drizzle-orm";
import type { RlsDb } from "@/db/client";
import { leads } from "@/db/schema";
import type { CompanySession } from "@/lib/auth/session";

/**
 * Org-scoping plus the "agent" role's resource-level restriction (CLAUDE.md
 * §7 / ROLE_PERMISSIONS' doc comment: "Assigned leads and conversations
 * only"): an agent may act on a lead that's unassigned or assigned to them,
 * never someone else's. Every other role's `leads.*` permission already
 * covers the whole org, so this only narrows behavior for `agent`. Treats a
 * restricted lead exactly like a nonexistent one (no existence leak) —
 * every call site here already does the same for cross-org leads.
 */
export async function assertLeadBelongsToOrg(tx: RlsDb, leadId: string, session: CompanySession): Promise<void> {
  const [row] = await tx
    .select({ id: leads.id, assignedUserId: leads.assignedUserId })
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.organizationId, session.organizationId)))
    .limit(1);
  if (!row) {
    throw new Error("Lead not found");
  }
  if (session.role === "agent" && row.assignedUserId && row.assignedUserId !== session.userId) {
    throw new Error("Lead not found");
  }
}
