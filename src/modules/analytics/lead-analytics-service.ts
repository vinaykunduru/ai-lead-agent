import "server-only";
import { and, eq } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { leads } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { getLeadDashboardMetrics, type LeadDashboardMetrics } from "@/modules/leads/dashboard-service";
import { ensureDefaultStages } from "@/modules/leads/stages-service";
import { dateRangeConditions } from "./shared";
import type { AnalyticsFilter } from "./validation";

export type PipelineStageCount = { stageId: string; name: string; sortOrder: number; count: number };
export type FunnelStep = { stageId: string; name: string; sortOrder: number; countAtOrBeyond: number };

export type LeadAnalytics = {
  averageScore: number;
  qualifiedLeads: number;
  won: number;
  lost: number;
  conversionRate: number;
  pipelineDistribution: PipelineStageCount[];
  funnel: FunnelStep[];
};

/**
 * Lead Analytics (module spec §3). averageScore/qualifiedLeads/won/lost/
 * conversionRate are reused as-is from modules/leads/dashboard-service.ts's
 * getLeadDashboardMetrics() — not recomputed here. pipelineDistribution and
 * funnel are genuinely new groupings (current count per stage, and a
 * "reached this stage or later" cumulative count) that dashboard-service.ts
 * doesn't already provide.
 *
 * The funnel assumes leads move forward through stages in `sortOrder`
 * (true for the default pipeline) — a company that has reordered its
 * pipeline non-sequentially will see a funnel that isn't strictly
 * decreasing, the same kind of documented approximation
 * dashboard-service.ts already accepts for its "Qualified"/"Meetings"
 * stage-name matching.
 */
export async function getLeadAnalytics(filter: AnalyticsFilter): Promise<LeadAnalytics> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  const leadMetrics: LeadDashboardMetrics = await getLeadDashboardMetrics();

  return withRlsContext(session.userId, async (tx) => {
    const stages = await ensureDefaultStages(tx, session.organizationId);

    const stageFilterCond = filter.stageId ? eq(leads.stageId, filter.stageId) : undefined;
    const baseConds = and(
      eq(leads.organizationId, session.organizationId),
      ...dateRangeConditions(leads.createdAt, filter),
      stageFilterCond,
    )!;

    const currentLeads = await tx.select({ stageId: leads.stageId }).from(leads).where(baseConds);
    const countByStage = new Map<string, number>();
    for (const lead of currentLeads) {
      countByStage.set(lead.stageId, (countByStage.get(lead.stageId) ?? 0) + 1);
    }

    const pipelineDistribution: PipelineStageCount[] = stages.map((s) => ({
      stageId: s.id,
      name: s.name,
      sortOrder: s.sortOrder,
      count: countByStage.get(s.id) ?? 0,
    }));

    const funnel: FunnelStep[] = stages.map((stage) => {
      const laterStageIds = new Set(stages.filter((s) => s.sortOrder >= stage.sortOrder).map((s) => s.id));
      const countAtOrBeyond = currentLeads.filter((l) => laterStageIds.has(l.stageId)).length;
      return { stageId: stage.id, name: stage.name, sortOrder: stage.sortOrder, countAtOrBeyond };
    });

    return {
      averageScore: leadMetrics.averageScore,
      qualifiedLeads: leadMetrics.qualifiedLeads,
      won: leadMetrics.won,
      lost: leadMetrics.lost,
      conversionRate: leadMetrics.conversionRate,
      pipelineDistribution,
      funnel,
    };
  });
}

