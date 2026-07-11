import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationMessages, type ConversationMessage, type NewConversationMessage } from "@/db/schema";

export async function insertMessage(values: NewConversationMessage): Promise<ConversationMessage> {
  const [row] = await db.insert(conversationMessages).values(values).returning();
  return row;
}

export async function updateMessage(
  id: string,
  patch: Partial<NewConversationMessage>,
): Promise<ConversationMessage> {
  const [row] = await db
    .update(conversationMessages)
    .set(patch)
    .where(eq(conversationMessages.id, id))
    .returning();
  return row;
}

export async function listMessages(conversationId: string): Promise<ConversationMessage[]> {
  return db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.createdAt));
}
