import "server-only";
import { and, eq } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { conversations, type Conversation } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { recordActivity } from "@/modules/leads/activity";
import { assertConversationAccessible, findLeadIdForConversation } from "./shared";

/**
 * Human Takeover (module spec §6): AI → Human → AI Resume. Flipping
 * `conversations.owner` is the only thing that changes AI-answering
 * behaviour — modules/conversation/execution-pipeline.ts checks this same
 * field and skips calling the provider whenever it's 'human'. Full message
 * history is untouched either way ("History preserved").
 */
export async function takeoverConversation(conversationId: string): Promise<Conversation> {
  const session = await requireCompanySession();
  assertPermission(session, "inbox.reply");

  const conversation = await withRlsContext(session.userId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.organizationId, session.organizationId)))
      .limit(1);
    if (!existing) throw new Error("Conversation not found");
    assertConversationAccessible(existing, session);

    const [row] = await tx
      .update(conversations)
      .set({
        owner: "human",
        assignedUserId: session.userId,
        takeoverReason: "manual",
        takeoverAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId))
      .returning();
    if (!row) throw new Error("Conversation not found");

    const leadId = await findLeadIdForConversation(tx, session.organizationId, conversationId);
    if (leadId) {
      await recordActivity(tx, {
        organizationId: session.organizationId,
        leadId,
        type: "takeover_started",
        actorUserId: session.userId,
        metadata: { reason: "manual" },
      });
    }

    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "inbox.takeover_started",
    resourceType: "conversation",
    resourceId: conversationId,
    metadata: { reason: "manual" },
  });

  return conversation;
}

export async function resumeAiConversation(conversationId: string): Promise<Conversation> {
  const session = await requireCompanySession();
  assertPermission(session, "inbox.reply");

  const conversation = await withRlsContext(session.userId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.organizationId, session.organizationId)))
      .limit(1);
    if (!existing) throw new Error("Conversation not found");
    assertConversationAccessible(existing, session);

    const [row] = await tx
      .update(conversations)
      .set({ owner: "ai", updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))
      .returning();
    if (!row) throw new Error("Conversation not found");

    const leadId = await findLeadIdForConversation(tx, session.organizationId, conversationId);
    if (leadId) {
      await recordActivity(tx, {
        organizationId: session.organizationId,
        leadId,
        type: "takeover_ended",
        actorUserId: session.userId,
      });
    }

    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "inbox.takeover_ended",
    resourceType: "conversation",
    resourceId: conversationId,
  });

  return conversation;
}
