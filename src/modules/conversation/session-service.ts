import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  conversationSessions,
  conversations,
  type Conversation,
  type ConversationSession,
} from "@/db/schema";

/**
 * Finds or creates the visitor's persistent session for this widget — see
 * db/schema/conversation-sessions.ts for why this is a separate concept
 * from a `conversation` thread. Service-role: no visitor session exists
 * (CLAUDE.md §3.6).
 */
export async function resolveSession(
  organizationId: string,
  widgetId: string,
  visitorId: string,
): Promise<ConversationSession> {
  const [existing] = await db
    .select()
    .from(conversationSessions)
    .where(and(eq(conversationSessions.widgetId, widgetId), eq(conversationSessions.visitorId, visitorId)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(conversationSessions)
      .set({ status: "active", lastActivityAt: new Date(), updatedAt: new Date() })
      .where(eq(conversationSessions.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(conversationSessions)
    .values({ organizationId, widgetId, visitorId })
    .returning();
  return created;
}

/**
 * Reuses `conversationId` if the caller supplied one and it genuinely
 * belongs to this session; otherwise starts a new thread. A stale or
 * forged conversationId (e.g. from an old localStorage value after the
 * widget's data was reset) never errors the visitor's chat — it just
 * starts a fresh conversation, silently.
 */
export async function resolveConversation(
  session: ConversationSession,
  conversationId: string | undefined,
): Promise<Conversation> {
  if (conversationId) {
    const [existing] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.sessionId, session.id)))
      .limit(1);
    if (existing) return existing;
  }

  const [created] = await db
    .insert(conversations)
    .values({ organizationId: session.organizationId, widgetId: session.widgetId, sessionId: session.id })
    .returning();
  return created;
}

export async function touchActivity(sessionId: string, conversationId: string): Promise<void> {
  const now = new Date();
  await Promise.all([
    db
      .update(conversationSessions)
      .set({ lastActivityAt: now, updatedAt: now })
      .where(eq(conversationSessions.id, sessionId)),
    db
      .update(conversations)
      .set({ lastActivityAt: now, updatedAt: now })
      .where(eq(conversations.id, conversationId)),
  ]);
}
