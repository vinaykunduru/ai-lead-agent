import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { leadScores, leads, visitorProfiles } from "@/db/schema";
import { recordActivity } from "./activity";
import { computeLeadScore, type LeadScoreSignals } from "./scoring";

/**
 * Service-role — called from the background extraction pass (Stage 2), no
 * company session. Only touches `leads.score`/`leads.qualificationStatus`;
 * intent/sentiment/conversationSummary/nextRecommendedAction live on
 * `visitor_profiles` only (see modules/visitor-profiles/resolve-service.ts)
 * — not duplicated here (Lead Model decision: one active lead per visitor,
 * so the Visitor Profile's AI fields already describe the current
 * engagement; a Customer 360 view reads them through the lead's
 * `visitorProfileId`).
 *
 * Reuses computeLeadScore/LeadScoreSignals as-is — the same weight table
 * modules/leads/ai-summary.ts's manual "Generate Summary" already uses, so
 * an automatic and a manual score are never computed two different ways.
 */
export async function updateLeadFromExtraction(
  leadId: string,
  input: {
    organizationId: string;
    qualificationStatus: "cold" | "warm" | "hot" | null;
    signals: {
      intentScore: number;
      urgencyScore: number;
      buyingSignalsScore: number;
      supportSignalsScore: number;
      budgetMentioned: boolean;
      messageCount: number;
    };
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [lead] = await tx.select().from(leads).where(eq(leads.id, leadId)).limit(1);
    if (!lead) return;

    const [profile] = lead.visitorProfileId
      ? await tx.select().from(visitorProfiles).where(eq(visitorProfiles.id, lead.visitorProfileId)).limit(1)
      : [];

    const [latestScore] = await tx
      .select({ signals: leadScores.signals })
      .from(leadScores)
      .where(and(eq(leadScores.leadId, leadId), eq(leadScores.organizationId, input.organizationId)))
      .orderBy(desc(leadScores.createdAt))
      .limit(1);
    // Preserve any prior manual override rather than discarding it on an
    // automatic refresh — same rule generateLeadSummary already follows.
    const priorManualAdjustment = (latestScore?.signals as LeadScoreSignals | undefined)?.manualAdjustment ?? 0;

    const signals: LeadScoreSignals = {
      emailCaptured: Boolean(profile?.email ?? lead.email),
      phoneCaptured: Boolean(profile?.phone ?? lead.phone),
      companyCaptured: Boolean(profile?.company ?? lead.company),
      messageCount: input.signals.messageCount,
      budgetMentioned: input.signals.budgetMentioned,
      intentScore: input.signals.intentScore,
      urgencyScore: input.signals.urgencyScore,
      buyingSignalsScore: input.signals.buyingSignalsScore,
      supportSignalsScore: input.signals.supportSignalsScore,
      manualAdjustment: priorManualAdjustment,
    };
    const totalScore = computeLeadScore(signals);

    await tx
      .update(leads)
      .set({
        score: totalScore,
        qualificationStatus: input.qualificationStatus ?? lead.qualificationStatus,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(leads.id, leadId));

    await tx.insert(leadScores).values({ organizationId: input.organizationId, leadId, signals, totalScore });

    await recordActivity(tx, {
      organizationId: input.organizationId,
      leadId,
      type: "score_updated",
      actorUserId: null,
      metadata: { totalScore, source: "ai_extraction" },
    });
  });
}
