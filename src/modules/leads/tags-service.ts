import "server-only";
import { and, eq } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { leadTags, type LeadTag } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { recordActivity } from "./activity";
import { assertLeadBelongsToOrg } from "./shared";
import type { AddTagInput } from "./validation";

export async function listTags(leadId: string): Promise<LeadTag[]> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.view");

  return withRlsContext(session.userId, async (tx) => {
    await assertLeadBelongsToOrg(tx, leadId, session);
    return tx.select().from(leadTags).where(eq(leadTags.leadId, leadId));
  });
}

export async function addTag(leadId: string, input: AddTagInput): Promise<LeadTag> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.update");

  const tag = await withRlsContext(session.userId, async (tx) => {
    await assertLeadBelongsToOrg(tx, leadId, session);
    const [row] = await tx
      .insert(leadTags)
      .values({ organizationId: session.organizationId, leadId, tag: input.tag, createdBy: session.userId })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new Error("Tag already exists on this lead");

    await recordActivity(tx, {
      organizationId: session.organizationId,
      leadId,
      type: "tag_added",
      actorUserId: session.userId,
      metadata: { tag: input.tag },
    });
    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "leads.tag_added",
    resourceType: "lead",
    resourceId: leadId,
    metadata: { tag: input.tag },
  });

  return tag;
}

export async function removeTag(leadId: string, tagId: string): Promise<void> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.update");

  const removed = await withRlsContext(session.userId, async (tx) => {
    await assertLeadBelongsToOrg(tx, leadId, session);
    const [row] = await tx
      .delete(leadTags)
      .where(and(eq(leadTags.id, tagId), eq(leadTags.leadId, leadId), eq(leadTags.organizationId, session.organizationId)))
      .returning();
    if (!row) throw new Error("Tag not found");

    await recordActivity(tx, {
      organizationId: session.organizationId,
      leadId,
      type: "tag_removed",
      actorUserId: session.userId,
      metadata: { tag: row.tag },
    });
    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "leads.tag_removed",
    resourceType: "lead",
    resourceId: leadId,
    metadata: { tag: removed.tag },
  });
}
