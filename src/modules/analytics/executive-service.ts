import "server-only";
import { eq, isNotNull, sql } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { conversationMessages, conversationUsage, conversations, leads } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { getLeadDashboardMetrics } from "@/modules/leads/dashboard-service";
import { combine, dateRangeConditions } from "./shared";
import type { AnalyticsFilter } from "./validation";

export type ExecutiveDashboard = {
  totalConversations: number;
  activeConversations: number;
  leadsGenerated: number;
  conversionRate: number;
  humanTakeovers: number;
  aiResolutionRate: number;
  avgResponseTimeMs: number | null;
  avgConversationLength: number;
  /** Module spec §1: "CSAT placeholder" — no CSAT survey mechanism exists
   * anywhere in this codebase (out of scope per DO-NOT-BUILD), so this is
   * always null rather than a fabricated number. */
  csat: null;
  estimatedCostUsd: number;
};

/**
 * The Executive Dashboard (module spec §1). Reuses
 * modules/leads/dashboard-service.ts's getLeadDashboardMetrics() for
 * conversionRate — the exact same isWon/isLost-based definition already
 * established in Phase 6, not recomputed here. Everything else is fresh
 * aggregation over conversations/conversation_usage/leads because it needs
 * to respect this report's own date-range filter, which
 * getLeadDashboardMetrics does not take.
 */
export async function getExecutiveDashboard(filter: AnalyticsFilter): Promise<ExecutiveDashboard> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  const leadMetrics = await getLeadDashboardMetrics();

  return withRlsContext(session.userId, async (tx) => {
    const widgetCond = filter.widgetId ? eq(conversations.widgetId, filter.widgetId) : undefined;
    const conversationConds = combine(
      eq(conversations.organizationId, session.organizationId),
      ...dateRangeConditions(conversations.startedAt, filter),
      widgetCond,
    );

    const [
      [{ count: totalConversations }],
      [{ count: activeConversations }],
      [{ count: humanTakeovers }],
      [{ count: leadsGenerated }],
      [{ count: totalMessages }],
      [{ avg: avgLatencyRaw }],
      [{ sum: costRaw }],
    ] = await Promise.all([
      tx.select({ count: sql<number>`count(*)::int` }).from(conversations).where(conversationConds),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(combine(eq(conversations.organizationId, session.organizationId), eq(conversations.status, "active"), widgetCond)),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(combine(conversationConds, isNotNull(conversations.takeoverAt))),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(leads)
        .where(combine(eq(leads.organizationId, session.organizationId), ...dateRangeConditions(leads.createdAt, filter))),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(conversationMessages)
        .innerJoin(conversations, eq(conversations.id, conversationMessages.conversationId))
        .where(conversationConds),
      tx
        .select({ avg: sql<string | null>`avg(${conversationUsage.latencyMs})` })
        .from(conversationUsage)
        .innerJoin(conversations, eq(conversations.id, conversationUsage.conversationId))
        .where(conversationConds),
      tx
        .select({ sum: sql<string | null>`sum(${conversationUsage.estimatedCostUsd})` })
        .from(conversationUsage)
        .innerJoin(conversations, eq(conversations.id, conversationUsage.conversationId))
        .where(conversationConds),
    ]);

    return {
      totalConversations,
      activeConversations,
      leadsGenerated,
      conversionRate: leadMetrics.conversionRate,
      humanTakeovers,
      aiResolutionRate: totalConversations > 0 ? Math.round(((totalConversations - humanTakeovers) / totalConversations) * 100) : 0,
      avgResponseTimeMs: avgLatencyRaw ? Math.round(Number(avgLatencyRaw)) : null,
      avgConversationLength: totalConversations > 0 ? Math.round((totalMessages / totalConversations) * 10) / 10 : 0,
      csat: null,
      estimatedCostUsd: costRaw ? Number(costRaw) : 0,
    };
  });
}

