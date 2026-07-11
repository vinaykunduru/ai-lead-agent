import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { leadStages, leadTags, leads } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import type { LeadAiSummary } from "../ai-summary";
import { csvLeadExportProvider } from "./csv";
import type { LeadExportRecord } from "./types";

/**
 * Assembles export-ready records from real lead data and hands them to a
 * LeadExportProvider (module spec §14) — company-authenticated, RLS-scoped,
 * same as every other lead read in this module.
 */
export async function exportLeadsAsCsv(filter?: { leadIds?: string[] }): Promise<string> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.view");

  const records = await withRlsContext(session.userId, async (tx) => {
    const conditions = [eq(leads.organizationId, session.organizationId)];
    if (filter?.leadIds && filter.leadIds.length > 0) {
      conditions.push(inArray(leads.id, filter.leadIds));
    }

    const rows = await tx
      .select({ lead: leads, stageName: leadStages.name })
      .from(leads)
      .innerJoin(leadStages, eq(leadStages.id, leads.stageId))
      .where(and(...conditions));

    const leadIds = rows.map((r) => r.lead.id);
    const tags = leadIds.length > 0 ? await tx.select().from(leadTags).where(inArray(leadTags.leadId, leadIds)) : [];
    const tagsByLead = new Map<string, string[]>();
    for (const tag of tags) {
      const list = tagsByLead.get(tag.leadId) ?? [];
      list.push(tag.tag);
      tagsByLead.set(tag.leadId, list);
    }

    return rows.map(
      (row): LeadExportRecord => ({
        id: row.lead.id,
        name: row.lead.name,
        email: row.lead.email,
        phone: row.lead.phone,
        company: row.lead.company,
        location: row.lead.location,
        stage: row.stageName,
        priority: row.lead.priority,
        score: row.lead.score,
        tags: tagsByLead.get(row.lead.id) ?? [],
        summary: (row.lead.aiSummary as LeadAiSummary | null) ?? null,
        createdAt: row.lead.createdAt.toISOString(),
      }),
    );
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "leads.exported",
    resourceType: "lead",
    metadata: { count: records.length, format: "csv" },
  });

  return csvLeadExportProvider.export(records);
}
