import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { widgets } from "./widgets";

/** One row per widget — Behaviour configuration. */
export const widgetSettings = pgTable("widget_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  widgetId: uuid("widget_id")
    .notNull()
    .unique()
    .references(() => widgets.id, { onDelete: "cascade" }),
  welcomeMessage: text("welcome_message"),
  suggestedQuestions: jsonb("suggested_questions").notNull().default([]),
  showTypingIndicator: boolean("show_typing_indicator").notNull().default(true),
  showBranding: boolean("show_branding").notNull().default(true),
  offlineMessage: text("offline_message"),
  showTimestamp: boolean("show_timestamp").notNull().default(true),
  showPoweredBy: boolean("show_powered_by").notNull().default(true),
  autoOpen: boolean("auto_open").notNull().default(false),
  autoOpenDelaySeconds: integer("auto_open_delay_seconds").notNull().default(5),
  // How long the embed SDK keeps reusing one conversation across page
  // navigation/refresh before starting a fresh thread (module spec:
  // "configurable duration, e.g. 24 hours") — purely a client-side
  // persistence TTL read by modules/widget/sdk-source.ts; conversation_sessions
  // itself never expires server-side (session-service.ts always reactivates
  // an existing session for a returning visitorId).
  sessionTimeoutMinutes: integer("session_timeout_minutes").notNull().default(1440),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WidgetSettings = typeof widgetSettings.$inferSelect;
export type NewWidgetSettings = typeof widgetSettings.$inferInsert;
