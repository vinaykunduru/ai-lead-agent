import "server-only";
import { and, eq, gte, ilike, sql } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { conversations, leadActivity, leadStages, leads } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";

export type LeadDashboardMetrics = {
  newLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
  averageScore: number;
  openConversations: number;
  humanTakeovers: number;
  meetings: number;
  won: number;
  lost: number;
};

const NEW_LEADS_WINDOW_DAYS = 30;

/**
 * Won/Lost/Conversion Rate use lead_stages.isWon/isLost (module spec §1's
 * terminal-stage markers) so they stay correct even if a company renames
 * its stages. "Qualified"/"Meetings" have no dedicated boolean — those two
 * match the stage *name* case-insensitively, which only reflects reality
 * for companies still using (something close to) the 8 default stage
 * names; a documented, reasonable limitation rather than a fabricated
 * precise number.
 */
export async function getLeadDashboardMetrics(): Promise<LeadDashboardMetrics> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.view");

  return withRlsContext(session.userId, async (tx) => {
    const since = new Date(Date.now() - NEW_LEADS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [
      [{ count: newLeads }],
      [{ count: qualifiedLeads }],
      [{ count: meetings }],
      [{ count: won }],
      [{ count: lost }],
      [{ avg: averageScoreRaw }],
      [{ count: openConversations }],
      [{ count: humanTakeovers }],
    ] = await Promise.all([
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(and(eq(leads.organizationId, session.organizationId), gte(leads.createdAt, since))),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .innerJoin(leadStages, eq(leadStages.id, leads.stageId))
        .where(and(eq(leads.organizationId, session.organizationId), ilike(leadStages.name, "qualified"))),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .innerJoin(leadStages, eq(leadStages.id, leads.stageId))
        .where(and(eq(leads.organizationId, session.organizationId), ilike(leadStages.name, "meeting scheduled"))),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .innerJoin(leadStages, eq(leadStages.id, leads.stageId))
        .where(and(eq(leads.organizationId, session.organizationId), eq(leadStages.isWon, true))),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .innerJoin(leadStages, eq(leadStages.id, leads.stageId))
        .where(and(eq(leads.organizationId, session.organizationId), eq(leadStages.isLost, true))),
      tx
        .select({ avg: sql<string | null>`avg(${leads.score})` })
        .from(leads)
        .where(eq(leads.organizationId, session.organizationId)),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(and(eq(conversations.organizationId, session.organizationId), eq(conversations.status, "active"))),
      tx
        .select({ count: sql<number>`count(distinct ${leadActivity.leadId})::int` })
        .from(leadActivity)
        .where(
          and(
            eq(leadActivity.organizationId, session.organizationId),
            sql`${leadActivity.type} in ('takeover_started', 'escalated')`,
          ),
        ),
    ]);

    const averageScore = averageScoreRaw ? Math.round(Number(averageScoreRaw)) : 0;
    const conversionRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;

    return {
      newLeads,
      qualifiedLeads,
      conversionRate,
      averageScore,
      openConversations,
      humanTakeovers,
      meetings,
      won,
      lost,
    };
  });
}
