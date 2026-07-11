import "server-only";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationMessages, conversations } from "@/db/schema";
import { resolveWidgetForPublicRequest, INVALID_WIDGET_ERROR } from "@/modules/widget/resolve-public-request";

/**
 * Public-safe message shape only — never provider, model, tokens, latency,
 * or errorMessage (all internal-only, module spec §14/§20). Used by the
 * embed SDK's polling loop (modules/widget/sdk-source.ts) so a visitor
 * sees a human agent's reply sent from the Inbox without needing a
 * persistent connection — module spec §6 "Human Takeover" is otherwise
 * invisible to the visitor, since Phase 5's SSE stream is scoped to one
 * request/response and closes as soon as that turn finishes.
 *
 * Deliberately a new, separate, plain GET+JSON endpoint — not a change to
 * the transport abstraction or the streaming execution pipeline, and not a
 * WebSocket (module spec explicitly excludes WebSockets from the
 * Conversation Engine and this milestone doesn't reopen that decision).
 */
export type PublicConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export async function getPublicMessages(
  publicKey: string,
  originHostname: string | null,
  conversationId: string,
  afterCreatedAt?: string,
): Promise<PublicConversationMessage[]> {
  const widget = await resolveWidgetForPublicRequest(publicKey, originHostname);

  const [conversation] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.widgetId, widget.id)))
    .limit(1);
  if (!conversation) {
    // Same generic message as every other public widget rejection — never
    // distinguishable from "widget invalid" (CLAUDE.md §4).
    throw new Error(INVALID_WIDGET_ERROR);
  }

  const conditions = [
    eq(conversationMessages.conversationId, conversationId),
    eq(conversationMessages.status, "complete"),
    inArray(conversationMessages.role, ["user", "assistant"]),
  ];
  if (afterCreatedAt) {
    const cursor = new Date(afterCreatedAt);
    if (!Number.isNaN(cursor.getTime())) {
      conditions.push(gt(conversationMessages.createdAt, cursor));
    }
  }

  const rows = await db
    .select({
      id: conversationMessages.id,
      role: conversationMessages.role,
      content: conversationMessages.content,
      createdAt: conversationMessages.createdAt,
    })
    .from(conversationMessages)
    .where(and(...conditions))
    .orderBy(asc(conversationMessages.createdAt));

  return rows.map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  }));
}
