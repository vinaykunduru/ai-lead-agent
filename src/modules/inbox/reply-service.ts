import "server-only";
import { and, eq } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { conversationMessages, conversations, type ConversationMessage } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { recordActivity } from "@/modules/leads/activity";
import { assertConversationAccessible, findLeadIdForConversation } from "./shared";
import type { ReplyInput } from "@/modules/leads/validation";

/**
 * Sends a human-authored reply. If the conversation isn't already taken
 * over, this implicitly takes it over in the same transaction as an atomic
 * step — an agent shouldn't need a separate "take over" click before their
 * first reply, and doing it atomically here (rather than as two calls from
 * the client) rules out a race where the AI answers the same pending
 * visitor message at the same time.
 *
 * `provider`/`model` stay null on the inserted row — that's exactly what
 * distinguishes a human-authored message from an AI-authored one
 * (modules/conversation/execution-pipeline.ts always sets both).
 */
export async function sendHumanReply(conversationId: string, input: ReplyInput): Promise<ConversationMessage> {
  const session = await requireCompanySession();
  assertPermission(session, "inbox.reply");

  const message = await withRlsContext(session.userId, async (tx) => {
    const [conversation] = await tx
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.organizationId, session.organizationId)))
      .limit(1);
    if (!conversation) throw new Error("Conversation not found");
    assertConversationAccessible(conversation, session);

    const [row] = await tx
      .insert(conversationMessages)
      .values({
        organizationId: session.organizationId,
        conversationId,
        role: "assistant",
        content: input.content,
        status: "complete",
      })
      .returning();

    const now = new Date();
    const wasAlreadyHuman = conversation.owner === "human";
    await tx
      .update(conversations)
      .set({
        lastActivityAt: now,
        updatedAt: now,
        ...(wasAlreadyHuman
          ? {}
          : { owner: "human" as const, assignedUserId: session.userId, takeoverReason: "manual" as const, takeoverAt: now }),
      })
      .where(eq(conversations.id, conversationId));

    if (!wasAlreadyHuman) {
      const leadId = await findLeadIdForConversation(tx, session.organizationId, conversationId);
      if (leadId) {
        await recordActivity(tx, {
          organizationId: session.organizationId,
          leadId,
          type: "takeover_started",
          actorUserId: session.userId,
          metadata: { reason: "manual", implicit: true },
        });
      }
    }

    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "inbox.reply_sent",
    resourceType: "conversation",
    resourceId: conversationId,
    // Never the reply content itself.
    metadata: { messageId: message.id },
  });

  return message;
}
