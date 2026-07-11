import "server-only";
import { eq, sql } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { conversationMessages, conversationUsage, conversations } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { combine, dateRangeConditions } from "./shared";
import type { AnalyticsFilter } from "./validation";

export type UsageBreakdown = { key: string; count: number; estimatedCostUsd: number };

export type AiPerformance = {
  avgPromptTokens: number;
  avgCompletionTokens: number;
  avgTokens: number;
  avgLatencyMs: number;
  providerUsage: UsageBreakdown[];
  modelUsage: UsageBreakdown[];
  estimatedCostUsd: number;
  failureRate: number;
  retryRate: number;
};

/**
 * AI Performance (module spec §4). Tokens/latency/cost/provider/model come
 * from conversation_usage — the ledger row modules/conversation/
 * usage-service.ts already writes per successful generation, reused as-is
 * (no new usage tracking added).
 *
 * failureRate: error-status assistant messages / all finished (complete or
 * error) assistant messages. retryRate: of conversations that had at least
 * one error, the fraction that later got a complete assistant message —
 * there is no explicit "regenerate" feature in this codebase (visitors just
 * send another message), so this is the closest honest proxy for "did the
 * conversation recover after a failure," computed with one conditional
 * aggregation query grouped by conversation rather than a self-join.
 */
export async function getAiPerformance(filter: AnalyticsFilter): Promise<AiPerformance> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  return withRlsContext(session.userId, async (tx) => {
    const widgetCond = filter.widgetId ? eq(conversations.widgetId, filter.widgetId) : undefined;
    const providerCond = filter.provider ? eq(conversationUsage.provider, filter.provider) : undefined;

    const usageConds = combine(
      eq(conversationUsage.organizationId, session.organizationId),
      ...dateRangeConditions(conversationUsage.createdAt, filter),
      providerCond,
      widgetCond,
    );

    const [[usageAgg], providerRows, modelRows] = await Promise.all([
      tx
        .select({
          avgPrompt: sql<string | null>`avg(${conversationUsage.promptTokens})`,
          avgCompletion: sql<string | null>`avg(${conversationUsage.completionTokens})`,
          avgLatency: sql<string | null>`avg(${conversationUsage.latencyMs})`,
          totalCost: sql<string | null>`sum(${conversationUsage.estimatedCostUsd})`,
        })
        .from(conversationUsage)
        .innerJoin(conversations, eq(conversations.id, conversationUsage.conversationId))
        .where(usageConds),
      tx
        .select({
          key: conversationUsage.provider,
          count: sql<number>`count(*)::int`,
          cost: sql<string>`sum(${conversationUsage.estimatedCostUsd})`,
        })
        .from(conversationUsage)
        .innerJoin(conversations, eq(conversations.id, conversationUsage.conversationId))
        .where(usageConds)
        .groupBy(conversationUsage.provider),
      tx
        .select({
          key: conversationUsage.model,
          count: sql<number>`count(*)::int`,
          cost: sql<string>`sum(${conversationUsage.estimatedCostUsd})`,
        })
        .from(conversationUsage)
        .innerJoin(conversations, eq(conversations.id, conversationUsage.conversationId))
        .where(usageConds)
        .groupBy(conversationUsage.model),
    ]);

    const messageConds = combine(
      eq(conversationMessages.organizationId, session.organizationId),
      eq(conversationMessages.role, "assistant"),
      ...dateRangeConditions(conversationMessages.createdAt, filter),
      widgetCond,
    );

    const perConversation = await tx
      .select({
        total: sql<number>`count(*) filter (where ${conversationMessages.status} in ('complete', 'error'))::int`,
        errors: sql<number>`count(*) filter (where ${conversationMessages.status} = 'error')::int`,
        hasError: sql<boolean>`bool_or(${conversationMessages.status} = 'error')`,
        firstErrorAt: sql<Date | null>`min(${conversationMessages.createdAt}) filter (where ${conversationMessages.status} = 'error')`,
        lastCompleteAt: sql<Date | null>`max(${conversationMessages.createdAt}) filter (where ${conversationMessages.status} = 'complete')`,
      })
      .from(conversationMessages)
      .innerJoin(conversations, eq(conversations.id, conversationMessages.conversationId))
      .where(messageConds)
      .groupBy(conversationMessages.conversationId);

    const totalFinished = perConversation.reduce((sum, r) => sum + r.total, 0);
    const totalErrors = perConversation.reduce((sum, r) => sum + r.errors, 0);
    const withError = perConversation.filter((r) => r.hasError);
    const recovered = withError.filter(
      (r) => r.lastCompleteAt && r.firstErrorAt && new Date(r.lastCompleteAt) > new Date(r.firstErrorAt),
    );

    const avgPrompt = usageAgg?.avgPrompt ? Number(usageAgg.avgPrompt) : 0;
    const avgCompletion = usageAgg?.avgCompletion ? Number(usageAgg.avgCompletion) : 0;

    return {
      avgPromptTokens: Math.round(avgPrompt),
      avgCompletionTokens: Math.round(avgCompletion),
      avgTokens: Math.round(avgPrompt + avgCompletion),
      avgLatencyMs: usageAgg?.avgLatency ? Math.round(Number(usageAgg.avgLatency)) : 0,
      providerUsage: providerRows.map((r) => ({ key: r.key, count: r.count, estimatedCostUsd: Number(r.cost) })),
      modelUsage: modelRows.map((r) => ({ key: r.key, count: r.count, estimatedCostUsd: Number(r.cost) })),
      estimatedCostUsd: usageAgg?.totalCost ? Number(usageAgg.totalCost) : 0,
      failureRate: totalFinished > 0 ? Math.round((totalErrors / totalFinished) * 1000) / 10 : 0,
      retryRate: withError.length > 0 ? Math.round((recovered.length / withError.length) * 1000) / 10 : 0,
    };
  });
}
