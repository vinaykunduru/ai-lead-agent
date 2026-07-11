import { pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { conversationSessions } from "./conversation-sessions";
import { organizations } from "./organizations";
import { widgets } from "./widgets";

export const conversationStatusEnum = pgEnum("conversation_status", ["active", "ended"]);

// Human Takeover (Phase 6 module spec §6): who currently owns generating
// replies in this conversation. 'ai' means handleIncomingMessage answers
// automatically (the Phase 5 behavior, unchanged as the default); 'human'
// means it stores the visitor's message and stops there — a human replies
// via modules/inbox instead. See modules/inbox/takeover-service.ts.
export const conversationOwnerEnum = pgEnum("conversation_owner", ["ai", "human"]);
export const conversationTakeoverReasonEnum = pgEnum("conversation_takeover_reason", [
  "manual",
  "automatic",
]);

/**
 * One message thread within a visitor session (see conversation-sessions.ts
 * for why these are separate tables). `widgetId`/`organizationId` are
 * denormalized from the session for query convenience and RLS — a
 * conversation never outlives or moves between sessions.
 */
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  widgetId: uuid("widget_id")
    .notNull()
    .references(() => widgets.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => conversationSessions.id, { onDelete: "cascade" }),
  status: conversationStatusEnum("status").notNull().default("active"),
  owner: conversationOwnerEnum("owner").notNull().default("ai"),
  assignedUserId: uuid("assigned_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  takeoverReason: conversationTakeoverReasonEnum("takeover_reason"),
  takeoverAt: timestamp("takeover_at", { withTimezone: true }),
  // Compared against lastActivityAt to derive the Inbox's "Unread" view —
  // null means never opened by an agent.
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
