import "server-only";
import { eq, sql } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { conversationMessages, conversationSessions, conversationUsage, conversations, widgets } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { combine, dateRangeConditions } from "./shared";
import type { AnalyticsFilter } from "./validation";

export type WidgetPerformance = { widgetId: string; name: string; avgLatencyMs: number; conversationCount: number };

export type WidgetAnalytics = {
  visitors: number;
  conversationsStarted: number;
  bounceRate: number;
  conversationCompletion: number;
  widgetPerformance: WidgetPerformance[];
};

/**
 * Widget Analytics (module spec §7). Visitors/sessions come from
 * conversation_sessions (one row per (widget, visitor) — modules/
 * conversation/session-service.ts). "Bounce" = a session whose visitor sent
 * at most one message across every conversation in that session before
 * leaving — the closest honest definition available without a page-view/
 * dwell-time tracking pixel, which this codebase doesn't have and this
 * phase doesn't add (module spec §7 lists no such requirement).
 */
export async function getWidgetAnalytics(filter: AnalyticsFilter): Promise<WidgetAnalytics> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  return withRlsContext(session.userId, async (tx) => {
    const widgetCond = filter.widgetId ? eq(conversationSessions.widgetId, filter.widgetId) : undefined;
    const sessionConds = combine(
      eq(conversationSessions.organizationId, session.organizationId),
      ...dateRangeConditions(conversationSessions.startedAt, filter),
      widgetCond,
    );

    const conversationWidgetCond = filter.widgetId ? eq(conversations.widgetId, filter.widgetId) : undefined;
    const conversationConds = combine(
      eq(conversations.organizationId, session.organizationId),
      ...dateRangeConditions(conversations.startedAt, filter),
      conversationWidgetCond,
    );

    const [
      [{ visitors }],
      [{ count: conversationsStarted }],
      [{ count: endedConversations }],
      sessionMessageCounts,
      performanceRows,
    ] = await Promise.all([
      tx.select({ visitors: sql<number>`count(distinct ${conversationSessions.visitorId})::int` }).from(conversationSessions).where(sessionConds),
      tx.select({ count: sql<number>`count(*)::int` }).from(conversations).where(conversationConds),
      tx.select({ count: sql<number>`count(*)::int` }).from(conversations).where(combine(conversationConds, eq(conversations.status, "ended"))),
      tx
        .select({
          sessionId: conversationSessions.id,
          userMessageCount: sql<number>`count(${conversationMessages.id}) filter (where ${conversationMessages.role} = 'user')::int`,
        })
        .from(conversationSessions)
        .leftJoin(conversations, eq(conversations.sessionId, conversationSessions.id))
        .leftJoin(conversationMessages, eq(conversationMessages.conversationId, conversations.id))
        .where(sessionConds)
        .groupBy(conversationSessions.id),
      tx
        .select({
          widgetId: conversations.widgetId,
          name: widgets.name,
          avgLatency: sql<string | null>`avg(${conversationUsage.latencyMs})`,
          conversationCount: sql<number>`count(distinct ${conversations.id})::int`,
        })
        .from(conversationUsage)
        .innerJoin(conversations, eq(conversations.id, conversationUsage.conversationId))
        .innerJoin(widgets, eq(widgets.id, conversations.widgetId))
        .where(conversationConds)
        .groupBy(conversations.widgetId, widgets.name),
    ]);

    const bounced = sessionMessageCounts.filter((s) => s.userMessageCount <= 1).length;

    return {
      visitors,
      conversationsStarted,
      bounceRate: sessionMessageCounts.length > 0 ? Math.round((bounced / sessionMessageCounts.length) * 1000) / 10 : 0,
      conversationCompletion: conversationsStarted > 0 ? Math.round((endedConversations / conversationsStarted) * 1000) / 10 : 0,
      widgetPerformance: performanceRows.map((r) => ({
        widgetId: r.widgetId,
        name: r.name,
        avgLatencyMs: r.avgLatency ? Math.round(Number(r.avgLatency)) : 0,
        conversationCount: r.conversationCount,
      })),
    };
  });
}
