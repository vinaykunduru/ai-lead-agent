import "server-only";
import { desc, eq, isNotNull, sql } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { conversations, widgets } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { combine, dateRangeConditions } from "./shared";
import type { ConversationSeriesQuery } from "./validation";

export type TimeSeriesPoint = { bucket: string; count: number };
export type CategoryCount = { key: string; label: string; count: number };

export type ConversationAnalytics = {
  series: TimeSeriesPoint[];
  byWidget: CategoryCount[];
  bySource: CategoryCount[];
  byLanguage: CategoryCount[];
  byAgent: CategoryCount[];
};

/**
 * Conversation Analytics (module spec §2). "By Source" and "By Language"
 * are honest approximations from existing data, not fabricated dimensions:
 * every conversation in this codebase currently comes through exactly one
 * channel (the website widget — CLAUDE.md §1, no WhatsApp/voice/email
 * implemented), so `bySource` is a single real bucket rather than invented
 * categories; `byLanguage` uses each widget's configured defaultLanguage
 * (there is no per-conversation detected-language field) as the closest
 * available proxy.
 */
export async function getConversationAnalytics(query: ConversationSeriesQuery): Promise<ConversationAnalytics> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  return withRlsContext(session.userId, async (tx) => {
    const widgetCond = query.widgetId ? eq(conversations.widgetId, query.widgetId) : undefined;
    const baseConds = combine(
      eq(conversations.organizationId, session.organizationId),
      ...dateRangeConditions(conversations.startedAt, query),
      widgetCond,
    );

    const bucketExpr = sql<string>`to_char(date_trunc(${query.bucket}, ${conversations.startedAt}), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;

    const [seriesRows, widgetRows, agentRows, languageRows, [{ count: total }]] = await Promise.all([
      tx
        .select({ bucket: bucketExpr, count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(baseConds)
        .groupBy(sql`1`)
        .orderBy(sql`1`),
      tx
        .select({ key: conversations.widgetId, label: widgets.name, count: sql<number>`count(*)::int` })
        .from(conversations)
        .innerJoin(widgets, eq(widgets.id, conversations.widgetId))
        .where(baseConds)
        .groupBy(conversations.widgetId, widgets.name)
        .orderBy(desc(sql`count(*)`)),
      tx
        .select({ key: conversations.assignedUserId, count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(combine(baseConds, isNotNull(conversations.assignedUserId)))
        .groupBy(conversations.assignedUserId)
        .orderBy(desc(sql`count(*)`)),
      tx
        .select({ key: widgets.defaultLanguage, count: sql<number>`count(*)::int` })
        .from(conversations)
        .innerJoin(widgets, eq(widgets.id, conversations.widgetId))
        .where(baseConds)
        .groupBy(widgets.defaultLanguage)
        .orderBy(desc(sql`count(*)`)),
      tx.select({ count: sql<number>`count(*)::int` }).from(conversations).where(baseConds),
    ]);

    return {
      series: seriesRows.map((r) => ({ bucket: r.bucket, count: r.count })),
      byWidget: widgetRows.map((r) => ({ key: r.key, label: r.label, count: r.count })),
      bySource: [{ key: "widget", label: "Website widget", count: total }],
      byLanguage: languageRows.map((r) => ({ key: r.key, label: r.key.toUpperCase(), count: r.count })),
      // `label` is left equal to the raw user id — resolving it to an email
      // requires the Supabase Auth Admin API (modules/organizations/
      // team-members.ts), which the UI already fetches separately and
      // matches against `key` client-side, the same pattern established for
      // Leads/Inbox in Phase 6.
      byAgent: agentRows.map((r) => ({ key: r.key!, label: r.key!, count: r.count })),
    };
  });
}
