import "server-only";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { conversationMessages, conversations, widgets, type Conversation } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import type { InboxQuery } from "@/modules/leads/validation";
import { assertConversationAccessible } from "./shared";

export type InboxConversationItem = Conversation & { widgetName: string };

const LIST_LIMIT = 50;

/**
 * The 7 Inbox views (module spec §5). Each is a plain filter over
 * `conversations` — no separate materialized view or extra table, since
 * every signal needed (owner, assignedUserId, lastReadAt vs
 * lastActivityAt, takeoverReason, status) already lives on the row itself
 * or one cheap correlated subquery (Needs Reply).
 */
export async function listInboxConversations(query: InboxQuery): Promise<InboxConversationItem[]> {
  const session = await requireCompanySession();
  assertPermission(session, "inbox.view");

  return withRlsContext(session.userId, async (tx) => {
    const conditions = [eq(conversations.organizationId, session.organizationId)];
    if (query.widgetId) conditions.push(eq(conversations.widgetId, query.widgetId));
    // "agent" only sees unassigned conversations or ones assigned to them —
    // same restriction as modules/leads/leads-service.ts's listLeads.
    if (session.role === "agent") {
      conditions.push(or(isNull(conversations.assignedUserId), eq(conversations.assignedUserId, session.userId))!);
    }

    switch (query.view) {
      case "assigned_to_me":
        conditions.push(eq(conversations.assignedUserId, session.userId));
        break;
      case "unassigned":
        conditions.push(isNull(conversations.assignedUserId));
        break;
      case "unread":
        conditions.push(
          or(isNull(conversations.lastReadAt), sql`${conversations.lastActivityAt} > ${conversations.lastReadAt}`)!,
        );
        break;
      case "needs_reply":
        conditions.push(eq(conversations.owner, "human"));
        conditions.push(
          sql`(select role from conversation_messages where conversation_id = ${conversations.id} order by created_at desc limit 1) = 'user'`,
        );
        break;
      case "escalated":
        conditions.push(eq(conversations.owner, "human"));
        conditions.push(eq(conversations.takeoverReason, "automatic"));
        break;
      case "closed":
        conditions.push(eq(conversations.status, "ended"));
        break;
      case "all":
      default:
        break;
    }

    const rows = await tx
      .select({ conversation: conversations, widgetName: widgets.name })
      .from(conversations)
      .innerJoin(widgets, eq(widgets.id, conversations.widgetId))
      .where(and(...conditions))
      .orderBy(desc(conversations.lastActivityAt))
      .limit(LIST_LIMIT);

    return rows.map((row) => ({ ...row.conversation, widgetName: row.widgetName }));
  });
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const session = await requireCompanySession();
  assertPermission(session, "inbox.view");

  await withRlsContext(session.userId, async (tx) => {
    const [conversation] = await tx
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.organizationId, session.organizationId)))
      .limit(1);
    if (!conversation) throw new Error("Conversation not found");
    assertConversationAccessible(conversation, session);

    await tx.update(conversations).set({ lastReadAt: new Date() }).where(eq(conversations.id, conversationId));
  });
}

export type InboxConversationDetail = {
  conversation: InboxConversationItem | null;
  messages: (typeof conversationMessages.$inferSelect)[];
};

export async function getInboxConversation(conversationId: string): Promise<InboxConversationDetail> {
  const session = await requireCompanySession();
  assertPermission(session, "inbox.view");

  return withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .select({ conversation: conversations, widgetName: widgets.name })
      .from(conversations)
      .innerJoin(widgets, eq(widgets.id, conversations.widgetId))
      .where(and(eq(conversations.id, conversationId), eq(conversations.organizationId, session.organizationId)))
      .limit(1);

    if (!row) return { conversation: null, messages: [] };
    if (session.role === "agent" && row.conversation.assignedUserId && row.conversation.assignedUserId !== session.userId) {
      return { conversation: null, messages: [] };
    }

    const messages = await tx
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(conversationMessages.createdAt);

    return { conversation: { ...row.conversation, widgetName: row.widgetName }, messages };
  });
}
