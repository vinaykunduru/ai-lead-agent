import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { conversations } from "./conversations";
import { organizations } from "./organizations";

export const conversationMessageRoleEnum = pgEnum("conversation_message_role", [
  "user",
  "assistant",
  "system",
  "tool",
]);

// "Streaming State" from the module spec — an assistant message is
// inserted as 'streaming' before the provider call starts, then flipped to
// 'complete' or 'error' once it finishes, so the Conversation Inspector
// (and a future reconnect flow) can see in-flight/failed generations, not
// just finished ones.
export const conversationMessageStatusEnum = pgEnum("conversation_message_status", [
  "pending",
  "streaming",
  "complete",
  "error",
]);

export const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: conversationMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  status: conversationMessageStatusEnum("status").notNull().default("complete"),
  // Free-form text, not the ai_provider enum (db/schema/ai-profiles.ts) —
  // this is a historical record of what was actually used, which must
  // never fail to insert if a provider is later renamed/deprecated. Null
  // for user/system messages.
  provider: text("provider"),
  model: text("model"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  latencyMs: integer("latency_ms"),
  // Safe, short diagnostic only (matches knowledge_documents.error_message's
  // convention) — never a raw stack trace or provider response body.
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;
