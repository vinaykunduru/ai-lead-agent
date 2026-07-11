import "server-only";
import { and, eq } from "drizzle-orm";
import type { RlsDb } from "@/db/client";
import { leads, type Conversation } from "@/db/schema";
import type { CompanySession } from "@/lib/auth/session";

/** A conversation may or may not have been converted into a lead yet —
 * used by takeover/reply to also log lead_activity when one exists. */
export async function findLeadIdForConversation(
  tx: RlsDb,
  organizationId: string,
  conversationId: string,
): Promise<string | null> {
  const [row] = await tx
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.conversationId, conversationId), eq(leads.organizationId, organizationId)))
    .limit(1);
  return row?.id ?? null;
}

/**
 * The "agent" role's resource-level restriction (same reasoning as
 * modules/leads/shared.ts's assertLeadBelongsToOrg): an agent may act on a
 * conversation that's unassigned or assigned to them, never someone else's.
 * Every other inbox.* role covers the whole org already.
 */
export function assertConversationAccessible(conversation: Conversation, session: CompanySession): void {
  if (session.role === "agent" && conversation.assignedUserId && conversation.assignedUserId !== session.userId) {
    throw new Error("Conversation not found");
  }
}
