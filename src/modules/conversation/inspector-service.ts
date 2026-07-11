import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import {
  conversationCitations,
  conversationMessages,
  conversationUsage,
  conversations,
  widgets,
  type Conversation,
  type ConversationCitation,
  type ConversationMessage,
  type ConversationUsage,
} from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";

export type ConversationListItem = Conversation & { widgetName: string; messageCount: number };

const LIST_PAGE_SIZE = 50;

/**
 * The Conversation Inspector (module spec §13) — an internal, read-only
 * developer tool for the company dashboard, not customer-facing. RLS-scoped
 * (withRlsContext), same as every other company-facing read in this
 * codebase — the public conversation pipeline that WRITES this data uses
 * the service-role client instead (modules/conversation/*-service.ts),
 * exactly like knowledge_chunks' existing split between company reads and
 * service-role writes.
 */
export async function listConversations(filter?: { widgetId?: string }): Promise<ConversationListItem[]> {
  const session = await requireCompanySession();
  assertPermission(session, "conversations.view");

  return withRlsContext(session.userId, async (tx) => {
    const conditions = [eq(conversations.organizationId, session.organizationId)];
    if (filter?.widgetId) {
      conditions.push(eq(conversations.widgetId, filter.widgetId));
    }

    const rows = await tx
      .select({
        conversation: conversations,
        widgetName: widgets.name,
      })
      .from(conversations)
      .innerJoin(widgets, eq(widgets.id, conversations.widgetId))
      .where(and(...conditions))
      .orderBy(desc(conversations.lastActivityAt))
      .limit(LIST_PAGE_SIZE);

    const counts = await tx
      .select({ conversationId: conversationMessages.conversationId })
      .from(conversationMessages)
      .where(eq(conversationMessages.organizationId, session.organizationId));
    const countByConversation = new Map<string, number>();
    for (const row of counts) {
      countByConversation.set(row.conversationId, (countByConversation.get(row.conversationId) ?? 0) + 1);
    }

    return rows.map((row) => ({
      ...row.conversation,
      widgetName: row.widgetName,
      messageCount: countByConversation.get(row.conversation.id) ?? 0,
    }));
  });
}

export type ConversationDetail = {
  conversation: (Conversation & { widgetName: string }) | null;
  messages: ConversationMessage[];
  citationsByMessageId: Record<string, ConversationCitation[]>;
  usageByMessageId: Record<string, ConversationUsage>;
};

export async function getConversationDetail(conversationId: string): Promise<ConversationDetail> {
  const session = await requireCompanySession();
  assertPermission(session, "conversations.view");

  return withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .select({ conversation: conversations, widgetName: widgets.name })
      .from(conversations)
      .innerJoin(widgets, eq(widgets.id, conversations.widgetId))
      .where(
        and(eq(conversations.id, conversationId), eq(conversations.organizationId, session.organizationId)),
      )
      .limit(1);

    if (!row) {
      return { conversation: null, messages: [], citationsByMessageId: {}, usageByMessageId: {} };
    }

    const [messages, citations, usage] = await Promise.all([
      tx
        .select()
        .from(conversationMessages)
        .where(eq(conversationMessages.conversationId, conversationId))
        .orderBy(conversationMessages.createdAt),
      tx.select().from(conversationCitations).where(eq(conversationCitations.conversationId, conversationId)),
      tx.select().from(conversationUsage).where(eq(conversationUsage.conversationId, conversationId)),
    ]);

    const citationsByMessageId: Record<string, ConversationCitation[]> = {};
    for (const citation of citations) {
      (citationsByMessageId[citation.messageId] ??= []).push(citation);
    }
    const usageByMessageId: Record<string, ConversationUsage> = {};
    for (const entry of usage) {
      usageByMessageId[entry.messageId] = entry;
    }

    return {
      conversation: { ...row.conversation, widgetName: row.widgetName },
      messages,
      citationsByMessageId,
      usageByMessageId,
    };
  });
}
