import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { widgets } from "./widgets";

export const conversationSessionStatusEnum = pgEnum("conversation_session_status", ["active", "ended"]);

/**
 * A visitor's persistent identity on a widget — one row per (widgetId,
 * visitorId) pair, roughly. `visitorId` is a client-generated, non-PII
 * correlation token the embed SDK creates and stores in localStorage on
 * first load (see modules/widget's sdk-source.ts) — never a real account,
 * never derived from anything the company or Anthropic controls. A single
 * session can span multiple `conversations` over time (the visitor closes
 * the tab and returns days later — same session, new thread).
 */
export const conversationSessions = pgTable("conversation_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  widgetId: uuid("widget_id")
    .notNull()
    .references(() => widgets.id, { onDelete: "cascade" }),
  visitorId: text("visitor_id").notNull(),
  status: conversationSessionStatusEnum("status").notNull().default("active"),
  // Light, non-PII operational context only (referrer URL, user agent) —
  // never anything resembling a lead record (CLAUDE.md scope: this module
  // never builds a CRM/lead pipeline).
  metadata: jsonb("metadata").notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConversationSession = typeof conversationSessions.$inferSelect;
export type NewConversationSession = typeof conversationSessions.$inferInsert;
