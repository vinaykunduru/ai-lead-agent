import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { leadNotes, type LeadNote } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { recordActivity } from "./activity";
import { assertLeadBelongsToOrg } from "./shared";
import type { AddNoteInput } from "./validation";

/** Internal only — module spec §7. Never read by any public/widget-facing
 * code path; only this RLS-scoped, company-authenticated service. */
export async function listNotes(leadId: string): Promise<LeadNote[]> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.view");

  return withRlsContext(session.userId, async (tx) => {
    await assertLeadBelongsToOrg(tx, leadId, session);
    return tx.select().from(leadNotes).where(eq(leadNotes.leadId, leadId)).orderBy(asc(leadNotes.createdAt));
  });
}

export async function addNote(leadId: string, input: AddNoteInput): Promise<LeadNote> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.update");

  const note = await withRlsContext(session.userId, async (tx) => {
    await assertLeadBelongsToOrg(tx, leadId, session);
    const [row] = await tx
      .insert(leadNotes)
      .values({ organizationId: session.organizationId, leadId, authorUserId: session.userId, content: input.content })
      .returning();

    await recordActivity(tx, {
      organizationId: session.organizationId,
      leadId,
      type: "note_added",
      actorUserId: session.userId,
      metadata: { preview: input.content.slice(0, 200) },
    });
    return row;
  });

  // Never the note content itself — CLAUDE.md §6: audit metadata must
  // never contain full content, only enough to identify what happened.
  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "leads.note_added",
    resourceType: "lead",
    resourceId: leadId,
    metadata: { noteId: note.id },
  });

  return note;
}

export async function deleteNote(leadId: string, noteId: string): Promise<void> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.update");

  await withRlsContext(session.userId, async (tx) => {
    await assertLeadBelongsToOrg(tx, leadId, session);
    const [row] = await tx
      .delete(leadNotes)
      .where(and(eq(leadNotes.id, noteId), eq(leadNotes.leadId, leadId), eq(leadNotes.organizationId, session.organizationId)))
      .returning();
    if (!row) throw new Error("Note not found");
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "leads.note_deleted",
    resourceType: "lead",
    resourceId: leadId,
    metadata: { noteId },
  });
}
