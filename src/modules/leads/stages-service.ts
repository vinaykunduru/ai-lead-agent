import "server-only";
import { and, asc, eq, notInArray } from "drizzle-orm";
import { type RlsDb, withRlsContext } from "@/db/client";
import { leadStages, type LeadStage } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import type { UpdateStagesInput } from "./validation";

const DEFAULT_STAGES: { name: string; isWon: boolean; isLost: boolean }[] = [
  { name: "New", isWon: false, isLost: false },
  { name: "Qualified", isWon: false, isLost: false },
  { name: "Contacted", isWon: false, isLost: false },
  { name: "Meeting Scheduled", isWon: false, isLost: false },
  { name: "Proposal Sent", isWon: false, isLost: false },
  { name: "Won", isWon: true, isLost: false },
  { name: "Lost", isWon: false, isLost: true },
  { name: "Archived", isWon: false, isLost: false },
];

/**
 * Every organization gets the 8 default stages the first time its pipeline
 * is touched (module spec §1) — same lazy-creation pattern as
 * modules/knowledge's default collection.
 */
export async function ensureDefaultStages(tx: RlsDb, organizationId: string): Promise<LeadStage[]> {
  const existing = await tx
    .select()
    .from(leadStages)
    .where(eq(leadStages.organizationId, organizationId))
    .orderBy(asc(leadStages.sortOrder));
  if (existing.length > 0) return existing;

  const created = await tx
    .insert(leadStages)
    .values(
      DEFAULT_STAGES.map((stage, index) => ({
        organizationId,
        name: stage.name,
        sortOrder: index,
        isWon: stage.isWon,
        isLost: stage.isLost,
      })),
    )
    .returning();
  return created.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listStages(): Promise<LeadStage[]> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.view");

  return withRlsContext(session.userId, (tx) => ensureDefaultStages(tx, session.organizationId));
}

/**
 * Replaces the company's whole stage list in one call — same "PATCH
 * replaces the ordered list" shape as modules/ai-behaviour's
 * business-rules-service.ts. Stages aren't deletable if they'd leave a
 * lead orphaned (leads.stage_id references lead_stages ON DELETE
 * RESTRICT) — removing a stage with existing leads fails at the database
 * level, not silently.
 */
export async function updateStages(input: UpdateStagesInput): Promise<LeadStage[]> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.update");

  const stages = await withRlsContext(session.userId, async (tx) => {
    await ensureDefaultStages(tx, session.organizationId);

    const incomingIds = input.stages.map((s) => s.id).filter((id): id is string => Boolean(id));
    if (incomingIds.length > 0) {
      await tx
        .delete(leadStages)
        .where(
          and(eq(leadStages.organizationId, session.organizationId), notInArray(leadStages.id, incomingIds)),
        );
    }

    const result: LeadStage[] = [];
    for (const [index, stage] of input.stages.entries()) {
      if (stage.id) {
        const [updated] = await tx
          .update(leadStages)
          .set({ name: stage.name, isWon: stage.isWon, isLost: stage.isLost, sortOrder: index, updatedAt: new Date() })
          .where(and(eq(leadStages.id, stage.id), eq(leadStages.organizationId, session.organizationId)))
          .returning();
        if (updated) result.push(updated);
      } else {
        const [created] = await tx
          .insert(leadStages)
          .values({
            organizationId: session.organizationId,
            name: stage.name,
            isWon: stage.isWon,
            isLost: stage.isLost,
            sortOrder: index,
          })
          .returning();
        result.push(created);
      }
    }
    return result;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "leads.stages_updated",
    resourceType: "lead_stages",
    metadata: { count: stages.length },
  });

  return stages.sort((a, b) => a.sortOrder - b.sortOrder);
}
