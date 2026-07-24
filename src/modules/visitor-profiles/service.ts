import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import {
  conversationSessions,
  conversations,
  leads,
  visitorProfiles,
  widgets,
  type Conversation,
  type Lead,
  type VisitorProfile,
} from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import type { UpdateVisitorProfileInput } from "./validation";

/**
 * Company-dashboard, RLS-scoped reads/writes for a Visitor Profile —
 * Customer 360 (module spec §9) and the Visitor Information panels on
 * Conversation/Lead detail. Gated by the existing `leads.view`/
 * `leads.update` permissions rather than a new permission constant — a
 * visitor profile has no meaning independent of the leads/conversations
 * that reference it, so it inherits their access rules.
 */
export async function getVisitorProfile(visitorProfileId: string): Promise<VisitorProfile | null> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.view");

  return withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .select()
      .from(visitorProfiles)
      .where(and(eq(visitorProfiles.id, visitorProfileId), eq(visitorProfiles.organizationId, session.organizationId)))
      .limit(1);
    return row ?? null;
  });
}

export async function updateVisitorProfile(
  visitorProfileId: string,
  input: UpdateVisitorProfileInput,
): Promise<VisitorProfile> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.update");

  const updated = await withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .update(visitorProfiles)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(visitorProfiles.id, visitorProfileId), eq(visitorProfiles.organizationId, session.organizationId)))
      .returning();
    if (!row) throw new Error("Visitor profile not found");
    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "visitor_profiles.updated",
    resourceType: "visitor_profile",
    resourceId: visitorProfileId,
    metadata: { fields: Object.keys(input) },
  });

  return updated;
}

/** Every lead ever tied to this visitor — open and closed — for the
 * Customer 360 timeline (module spec §9). Most orgs will only ever see one
 * open lead per visitor here (Lead Model decision #2); prior closed leads
 * still show up as history. */
export async function listVisitorProfileLeads(visitorProfileId: string): Promise<Lead[]> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.view");

  return withRlsContext(session.userId, (tx) =>
    tx
      .select()
      .from(leads)
      .where(and(eq(leads.visitorProfileId, visitorProfileId), eq(leads.organizationId, session.organizationId)))
      .orderBy(desc(leads.createdAt)),
  );
}

export type VisitorConversationListItem = Conversation & { widgetName: string };

/** Every conversation this visitor has had, across every widget/session —
 * this is the "multiple conversations, one visitor" view the Lead Model
 * decision requires, derived by joining through conversation_sessions
 * rather than stored as a separate list anywhere. */
export async function listVisitorProfileConversations(
  visitorProfileId: string,
): Promise<VisitorConversationListItem[]> {
  const session = await requireCompanySession();
  assertPermission(session, "conversations.view");

  return withRlsContext(session.userId, async (tx) => {
    const rows = await tx
      .select({ conversation: conversations, widgetName: widgets.name })
      .from(conversations)
      .innerJoin(conversationSessions, eq(conversationSessions.id, conversations.sessionId))
      .innerJoin(widgets, eq(widgets.id, conversations.widgetId))
      .where(
        and(
          eq(conversationSessions.visitorProfileId, visitorProfileId),
          eq(conversations.organizationId, session.organizationId),
        ),
      )
      .orderBy(desc(conversations.lastActivityAt));

    return rows.map((row) => ({ ...row.conversation, widgetName: row.widgetName }));
  });
}

export type VisitorContext = { profile: VisitorProfile; lead: Lead | null } | null;

/**
 * Shared by the Conversation Detail (Inspector) and Inbox Detail pages —
 * both need the same "who is this, and is there a lead for them" panel, so
 * this is the one place that resolves it. `lead` is whichever lead is tied
 * to this visitor profile with the most recent activity — not necessarily
 * "active" (Lead Model decision #2's closed leads still display, they just
 * won't receive new automatic updates).
 */
export async function getVisitorContextForConversation(conversationId: string): Promise<VisitorContext> {
  const session = await requireCompanySession();
  assertPermission(session, "conversations.view");

  return withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .select({ profile: visitorProfiles })
      .from(conversations)
      .innerJoin(conversationSessions, eq(conversationSessions.id, conversations.sessionId))
      .innerJoin(visitorProfiles, eq(visitorProfiles.id, conversationSessions.visitorProfileId))
      .where(and(eq(conversations.id, conversationId), eq(conversations.organizationId, session.organizationId)))
      .limit(1);

    if (!row) return null;

    const [lead] = await tx
      .select()
      .from(leads)
      .where(and(eq(leads.visitorProfileId, row.profile.id), eq(leads.organizationId, session.organizationId)))
      .orderBy(desc(leads.lastActivityAt))
      .limit(1);

    return { profile: row.profile, lead: lead ?? null };
  });
}
