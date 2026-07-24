import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, type RlsDb } from "@/db/client";
import { leads, type Lead, type NewLead } from "@/db/schema";
import { recordActivity } from "./activity";
import { ensureDefaultStages } from "./stages-service";
import { computeLeadScore, DEFAULT_SCORE_SIGNALS } from "./scoring";

/**
 * Service-role find-or-create for the automatic conversation pipeline — no
 * company session exists here (CLAUDE.md §3.6), same db.transaction()-not-
 * withRlsContext pattern already used by execution-pipeline.ts's
 * escalateToHuman. `ensureDefaultStages`/`recordActivity` are reused as-is:
 * both only take a transaction handle and an explicit organizationId, they
 * don't care whether RLS is active.
 *
 * "Active" = not sitting in a Won or Lost stage (Lead Model decision #2 —
 * one active lead per visitor; a closed lead is left alone and a fresh one
 * starts). Resolution is a straight find on `visitorProfileId`, not a
 * complex query, because at most one non-closed lead should ever exist per
 * visitor at a time — this function is also what enforces that invariant,
 * by only creating a new row once the prior one is closed.
 */
export async function resolveActiveLeadForVisitor(input: {
  organizationId: string;
  widgetId: string;
  conversationId: string;
  visitorProfileId: string;
}): Promise<Lead> {
  return db.transaction(async (tx: RlsDb) => {
    const stages = await ensureDefaultStages(tx, input.organizationId);
    const closedStageIds = new Set(stages.filter((s) => s.isWon || s.isLost).map((s) => s.id));

    const [existing] = await tx
      .select()
      .from(leads)
      .where(
        and(eq(leads.organizationId, input.organizationId), eq(leads.visitorProfileId, input.visitorProfileId)),
      )
      .orderBy(desc(leads.lastActivityAt))
      .limit(1);

    if (existing && !closedStageIds.has(existing.stageId)) {
      return existing;
    }

    const defaultStage = stages.find((s) => !s.isWon && !s.isLost) ?? stages[0];
    const values: NewLead = {
      organizationId: input.organizationId,
      widgetId: input.widgetId,
      conversationId: input.conversationId,
      visitorProfileId: input.visitorProfileId,
      stageId: defaultStage.id,
      source: "widget",
      score: computeLeadScore(DEFAULT_SCORE_SIGNALS),
    };
    const [created] = await tx.insert(leads).values(values).returning();

    await recordActivity(tx, {
      organizationId: input.organizationId,
      leadId: created.id,
      type: "lead_created",
      actorUserId: null,
      metadata: { source: "widget", createdByAi: true },
    });

    return created;
  });
}
