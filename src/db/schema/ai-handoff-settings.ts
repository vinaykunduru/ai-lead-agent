import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * One row per organization. This module only stores the configuration —
 * it does not implement escalation delivery (email sending, conversation
 * routing); that belongs to the future conversation-engine phase.
 */
export const aiHandoffSettings = pgTable("ai_handoff_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  escalationEnabled: boolean("escalation_enabled").notNull().default(false),
  escalationEmail: text("escalation_email"),
  escalationMessage: text("escalation_message"),
  manualReviewRequired: boolean("manual_review_required").notNull().default(false),
  maxAiAttempts: integer("max_ai_attempts").notNull().default(3),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiHandoffSettings = typeof aiHandoffSettings.$inferSelect;
export type NewAiHandoffSettings = typeof aiHandoffSettings.$inferInsert;
