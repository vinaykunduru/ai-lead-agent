import "server-only";
import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { conversationMessages, conversations } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { combine, dateRangeConditions } from "./shared";
import type { AnalyticsFilter } from "./validation";

export type AgentWorkload = { agentId: string; conversationCount: number };

export type InboxAnalytics = {
  takeovers: number;
  escalations: number;
  avgResponseTimeMs: number | null;
  avgResolutionTimeMs: number | null;
  agentWorkload: AgentWorkload[];
};

/**
 * Human Inbox Analytics (module spec §6). All derived from `conversations`
 * (owner/assignedUserId/takeoverReason/takeoverAt/endedAt) and
 * `conversation_messages` — modules/inbox's own tables, no new tracking.
 *
 * avgResponseTimeMs: for every human-authored reply (role=assistant,
 * provider IS NULL — exactly how modules/inbox/reply-service.ts marks a
 * message as human-written), the gap since the visitor's most recent prior
 * message in that conversation, averaged. avgResolutionTimeMs: for
 * conversations that were taken over AND have since ended, the gap between
 * takeoverAt and endedAt.
 */
export async function getInboxAnalytics(filter: AnalyticsFilter): Promise<InboxAnalytics> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  return withRlsContext(session.userId, async (tx) => {
    const agentCond = filter.agentId ? eq(conversations.assignedUserId, filter.agentId) : undefined;
    const widgetCond = filter.widgetId ? eq(conversations.widgetId, filter.widgetId) : undefined;
    const conversationConds = combine(
      eq(conversations.organizationId, session.organizationId),
      ...dateRangeConditions(conversations.startedAt, filter),
      agentCond,
      widgetCond,
    );

    const [
      [{ count: takeovers }],
      [{ count: escalations }],
      [avgResponse],
      [{ avg: avgResolutionRaw }],
      workloadRows,
    ] = await Promise.all([
      tx.select({ count: sql<number>`count(*)::int` }).from(conversations).where(combine(conversationConds, isNotNull(conversations.takeoverAt))),
      tx.select({ count: sql<number>`count(*)::int` }).from(conversations).where(combine(conversationConds, eq(conversations.takeoverReason, "automatic"))),
      tx
        .select({
          avgMs: sql<string | null>`avg(extract(epoch from (${conversationMessages.createdAt} - (
            select max(u.created_at) from conversation_messages u
            where u.conversation_id = ${conversationMessages.conversationId}
              and u.role = 'user'
              and u.created_at < ${conversationMessages.createdAt}
          ))) * 1000)`,
        })
        .from(conversationMessages)
        .innerJoin(conversations, eq(conversations.id, conversationMessages.conversationId))
        .where(
          combine(
            conversationConds,
            eq(conversationMessages.role, "assistant"),
            eq(conversationMessages.status, "complete"),
            sql`${conversationMessages.provider} is null`,
          ),
        ),
      tx
        .select({ avg: sql<string | null>`avg(extract(epoch from (${conversations.endedAt} - ${conversations.takeoverAt})) * 1000)` })
        .from(conversations)
        .where(combine(conversationConds, isNotNull(conversations.takeoverAt), isNotNull(conversations.endedAt))),
      tx
        .select({ agentId: conversations.assignedUserId, count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(combine(conversationConds, isNotNull(conversations.assignedUserId)))
        .groupBy(conversations.assignedUserId)
        .orderBy(desc(sql`count(*)`)),
    ]);

    return {
      takeovers,
      escalations,
      avgResponseTimeMs: avgResponse?.avgMs ? Math.round(Number(avgResponse.avgMs)) : null,
      avgResolutionTimeMs: avgResolutionRaw ? Math.round(Number(avgResolutionRaw)) : null,
      agentWorkload: workloadRows.map((r) => ({ agentId: r.agentId!, conversationCount: r.count })),
    };
  });
}
