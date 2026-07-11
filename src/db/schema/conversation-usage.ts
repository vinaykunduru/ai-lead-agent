import { integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { conversationMessages } from "./conversation-messages";
import { conversations } from "./conversations";
import { organizations } from "./organizations";

/**
 * A ledger row per assistant-message generation — decoupled from
 * conversation_messages so a future billing job can aggregate cost/usage
 * without scanning message content (module spec §10: "Future billing
 * extension point"). `estimatedCostUsd` is a rough estimate from a static
 * per-provider rate table (modules/conversation/usage-service.ts) — never
 * an authoritative billing figure.
 */
export const conversationUsage = pgTable("conversation_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  messageId: uuid("message_id")
    .notNull()
    .references(() => conversationMessages.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").notNull(),
  completionTokens: integer("completion_tokens").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 6 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConversationUsage = typeof conversationUsage.$inferSelect;
export type NewConversationUsage = typeof conversationUsage.$inferInsert;
