import "server-only";
import { and, desc, eq, exists, gte, ilike, isNull, lte, or } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import {
  leadAssignments,
  leadScores,
  leadStageHistory,
  leadStages,
  leadTags,
  leads,
  visitorProfiles,
  type Lead,
} from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { getConversationCountsByVisitorProfileId } from "@/modules/visitor-profiles/list-helpers";
import { recordActivity } from "./activity";
import { assertLeadBelongsToOrg } from "./shared";
import { ensureDefaultStages } from "./stages-service";
import { computeLeadScore, DEFAULT_SCORE_SIGNALS, type LeadScoreSignals } from "./scoring";
import type { AssignLeadInput, ChangeStageInput, CreateLeadInput, LeadSearchQuery, UpdateLeadInput } from "./validation";

const DEFAULT_LIST_LIMIT = 50;

/**
 * A lead's "visitor" columns prefer the linked Visitor Profile (richer,
 * kept in sync by automatic extraction) and fall back to the lead's own
 * inline name/email/phone/company for leads created before this feature or
 * without a resolvable visitor (Visitor Profile module spec: no backfill,
 * `visitorProfileId` may stay null forever on old rows).
 */
export type LeadListItem = Lead & {
  visitorName: string | null;
  visitorEmail: string | null;
  visitorPhone: string | null;
  visitorCompany: string | null;
  visitorIntent: string | null;
  conversationSummary: string | null;
  conversationCount: number;
};

export async function listLeads(filter: LeadSearchQuery = {}): Promise<LeadListItem[]> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.view");

  return withRlsContext(session.userId, async (tx) => {
    const conditions = [eq(leads.organizationId, session.organizationId)];

    // "agent" only sees unassigned leads or leads assigned to them
    // (ROLE_PERMISSIONS' doc comment / CLAUDE.md §7) — every other role's
    // leads.view already covers the whole org.
    if (session.role === "agent") {
      conditions.push(or(isNull(leads.assignedUserId), eq(leads.assignedUserId, session.userId))!);
    }

    if (filter.stageId) conditions.push(eq(leads.stageId, filter.stageId));
    if (filter.priority) conditions.push(eq(leads.priority, filter.priority));
    if (filter.assignedUserId) conditions.push(eq(leads.assignedUserId, filter.assignedUserId));
    if (filter.source) conditions.push(eq(leads.source, filter.source));
    if (filter.widgetId) conditions.push(eq(leads.widgetId, filter.widgetId));
    if (filter.minScore !== undefined) conditions.push(gte(leads.score, filter.minScore));
    if (filter.createdAfter) conditions.push(gte(leads.createdAt, new Date(filter.createdAfter)));
    if (filter.createdBefore) conditions.push(lte(leads.createdAt, new Date(filter.createdBefore)));
    if (filter.q) {
      const term = `%${filter.q}%`;
      conditions.push(
        or(
          ilike(leads.name, term),
          ilike(leads.email, term),
          ilike(leads.phone, term),
          ilike(leads.company, term),
          ilike(visitorProfiles.name, term),
          ilike(visitorProfiles.email, term),
          ilike(visitorProfiles.phone, term),
          ilike(visitorProfiles.company, term),
          ilike(visitorProfiles.industry, term),
          ilike(visitorProfiles.interestedService, term),
          ilike(visitorProfiles.intent, term),
        )!,
      );
    }
    if (filter.tag) {
      conditions.push(
        exists(
          tx
            .select({ id: leadTags.id })
            .from(leadTags)
            .where(and(eq(leadTags.leadId, leads.id), eq(leadTags.tag, filter.tag!))),
        ),
      );
    }

    const rows = await tx
      .select({ lead: leads, visitorProfile: visitorProfiles })
      .from(leads)
      .leftJoin(visitorProfiles, eq(visitorProfiles.id, leads.visitorProfileId))
      .where(and(...conditions))
      .orderBy(desc(leads.lastActivityAt))
      .limit(filter.limit ?? DEFAULT_LIST_LIMIT);

    const visitorProfileIds = [...new Set(rows.map((r) => r.visitorProfile?.id).filter((id): id is string => Boolean(id)))];
    const conversationCounts = await getConversationCountsByVisitorProfileId(tx, session.organizationId, visitorProfileIds);

    return rows.map((row) => ({
      ...row.lead,
      visitorName: row.visitorProfile?.name ?? row.lead.name,
      visitorEmail: row.visitorProfile?.email ?? row.lead.email,
      visitorPhone: row.visitorProfile?.phone ?? row.lead.phone,
      visitorCompany: row.visitorProfile?.company ?? row.lead.company,
      visitorIntent: row.visitorProfile?.intent ?? null,
      conversationSummary: row.visitorProfile?.conversationSummary ?? null,
      conversationCount: row.visitorProfile ? (conversationCounts.get(row.visitorProfile.id) ?? 0) : 0,
    }));
  });
}

export async function getLead(leadId: string): Promise<Lead | null> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.view");

  return withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), eq(leads.organizationId, session.organizationId)))
      .limit(1);
    if (!row) return null;
    // Same "unassigned or assigned to me" restriction as listLeads —
    // treated as not-found rather than forbidden, so an agent can't probe
    // for another agent's lead existing.
    if (session.role === "agent" && row.assignedUserId && row.assignedUserId !== session.userId) {
      return null;
    }
    return row;
  });
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.create");

  const lead = await withRlsContext(session.userId, async (tx) => {
    const stages = await ensureDefaultStages(tx, session.organizationId);
    let stageId = input.stageId;
    if (stageId) {
      const belongs = stages.some((s) => s.id === stageId);
      if (!belongs) throw new Error("Stage not found");
    } else {
      stageId = stages[0].id;
    }

    const [row] = await tx
      .insert(leads)
      .values({
        organizationId: session.organizationId,
        widgetId: input.widgetId ?? null,
        conversationId: input.conversationId ?? null,
        stageId,
        name: input.name ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        company: input.company ?? null,
        location: input.location ?? null,
        source: input.source ?? "widget",
        priority: input.priority ?? "medium",
      })
      .returning();

    await recordActivity(tx, {
      organizationId: session.organizationId,
      leadId: row.id,
      type: "lead_created",
      actorUserId: session.userId,
      metadata: { source: row.source },
    });

    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "leads.lead_created",
    resourceType: "lead",
    resourceId: lead.id,
  });

  return lead;
}

export async function updateLead(leadId: string, input: UpdateLeadInput): Promise<Lead> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.update");

  const { scoreAdjustment, ...fields } = input;

  const lead = await withRlsContext(session.userId, async (tx) => {
    await assertLeadBelongsToOrg(tx, leadId, session);

    const patch: Partial<typeof leads.$inferInsert> = { ...fields, updatedAt: new Date() };

    if (scoreAdjustment !== undefined) {
      const [latestScore] = await tx
        .select()
        .from(leadScores)
        .where(and(eq(leadScores.leadId, leadId), eq(leadScores.organizationId, session.organizationId)))
        .orderBy(desc(leadScores.createdAt))
        .limit(1);

      const signals: LeadScoreSignals = {
        ...(latestScore ? (latestScore.signals as LeadScoreSignals) : DEFAULT_SCORE_SIGNALS),
        manualAdjustment: scoreAdjustment,
      };
      const totalScore = computeLeadScore(signals);
      patch.score = totalScore;

      await tx.insert(leadScores).values({
        organizationId: session.organizationId,
        leadId,
        signals,
        totalScore,
      });
      await recordActivity(tx, {
        organizationId: session.organizationId,
        leadId,
        type: "score_updated",
        actorUserId: session.userId,
        metadata: { totalScore, manualAdjustment: scoreAdjustment },
      });
    }

    const [row] = await tx.update(leads).set(patch).where(eq(leads.id, leadId)).returning();

    if (Object.keys(fields).length > 0) {
      await recordActivity(tx, {
        organizationId: session.organizationId,
        leadId,
        type: "lead_updated",
        actorUserId: session.userId,
        metadata: { fields: Object.keys(fields) },
      });
    }

    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "leads.lead_updated",
    resourceType: "lead",
    resourceId: lead.id,
    metadata: { fields: Object.keys(input) },
  });

  return lead;
}

export async function changeLeadStage(leadId: string, input: ChangeStageInput): Promise<Lead> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.update");

  const lead = await withRlsContext(session.userId, async (tx) => {
    await assertLeadBelongsToOrg(tx, leadId, session);

    const [targetStage] = await tx
      .select()
      .from(leadStages)
      .where(and(eq(leadStages.id, input.stageId), eq(leadStages.organizationId, session.organizationId)))
      .limit(1);
    if (!targetStage) throw new Error("Stage not found");

    const [previous] = await tx.select({ stageId: leads.stageId }).from(leads).where(eq(leads.id, leadId)).limit(1);

    const [row] = await tx
      .update(leads)
      .set({ stageId: input.stageId, updatedAt: new Date(), lastActivityAt: new Date() })
      .where(eq(leads.id, leadId))
      .returning();

    await tx.insert(leadStageHistory).values({
      organizationId: session.organizationId,
      leadId,
      previousStageId: previous?.stageId ?? null,
      newStageId: input.stageId,
      changedByUserId: session.userId,
    });

    await recordActivity(tx, {
      organizationId: session.organizationId,
      leadId,
      type: "stage_changed",
      actorUserId: session.userId,
      metadata: { toStage: targetStage.name },
    });

    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "leads.stage_changed",
    resourceType: "lead",
    resourceId: lead.id,
    metadata: { stageId: input.stageId },
  });

  return lead;
}

export async function assignLead(leadId: string, input: AssignLeadInput): Promise<Lead> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.assign");

  const lead = await withRlsContext(session.userId, async (tx) => {
    await assertLeadBelongsToOrg(tx, leadId, session);

    const [previous] = await tx
      .select({ assignedUserId: leads.assignedUserId })
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    const [row] = await tx
      .update(leads)
      .set({ assignedUserId: input.userId, updatedAt: new Date(), lastActivityAt: new Date() })
      .where(eq(leads.id, leadId))
      .returning();

    await tx.insert(leadAssignments).values({
      organizationId: session.organizationId,
      leadId,
      previousAssigneeId: previous?.assignedUserId ?? null,
      newAssigneeId: input.userId,
      changedByUserId: session.userId,
    });

    await recordActivity(tx, {
      organizationId: session.organizationId,
      leadId,
      type: "assigned",
      actorUserId: session.userId,
      metadata: { assignedUserId: input.userId },
    });

    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "leads.lead_assigned",
    resourceType: "lead",
    resourceId: lead.id,
    metadata: { assignedUserId: input.userId },
  });

  return lead;
}

/** Real delete — unlike knowledge documents, leads has no "no permanent
 * delete" constraint in the module spec, and leads.delete is its own
 * explicit permission (e.g. removing spam/test leads). */
export async function deleteLead(leadId: string): Promise<void> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.delete");

  await withRlsContext(session.userId, async (tx) => {
    await assertLeadBelongsToOrg(tx, leadId, session);
    await tx.delete(leads).where(eq(leads.id, leadId));
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "leads.lead_deleted",
    resourceType: "lead",
    resourceId: leadId,
  });
}
