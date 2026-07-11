import "server-only";
import { desc, eq } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { leadActivity, leadAssignments, leadStageHistory, type LeadActivityEntry } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { assertLeadBelongsToOrg } from "./shared";

/** The unified activity feed for a lead's detail page (module spec §10). */
export async function getLeadTimeline(leadId: string): Promise<LeadActivityEntry[]> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.view");

  return withRlsContext(session.userId, async (tx) => {
    await assertLeadBelongsToOrg(tx, leadId, session);
    return tx.select().from(leadActivity).where(eq(leadActivity.leadId, leadId)).orderBy(desc(leadActivity.createdAt));
  });
}

export async function getAssignmentHistory(leadId: string) {
  const session = await requireCompanySession();
  assertPermission(session, "leads.view");

  return withRlsContext(session.userId, async (tx) => {
    await assertLeadBelongsToOrg(tx, leadId, session);
    return tx.select().from(leadAssignments).where(eq(leadAssignments.leadId, leadId)).orderBy(desc(leadAssignments.createdAt));
  });
}

export async function getStageHistory(leadId: string) {
  const session = await requireCompanySession();
  assertPermission(session, "leads.view");

  return withRlsContext(session.userId, async (tx) => {
    await assertLeadBelongsToOrg(tx, leadId, session);
    return tx.select().from(leadStageHistory).where(eq(leadStageHistory.leadId, leadId)).orderBy(desc(leadStageHistory.createdAt));
  });
}
