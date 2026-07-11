import { jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { leads } from "./leads";
import { organizations } from "./organizations";

export const leadActivityTypeEnum = pgEnum("lead_activity_type", [
  "lead_created",
  "lead_updated",
  "stage_changed",
  "assigned",
  "note_added",
  "tag_added",
  "tag_removed",
  "summary_generated",
  "score_updated",
  "escalated",
  "takeover_started",
  "takeover_ended",
]);

/**
 * The unified activity feed (module spec §10) — a denormalized event log
 * every lead-related mutation also writes one row into, so the Lead Detail
 * timeline is a single indexed query instead of a UNION across 5 tables.
 * `metadata` holds a small, safe, type-specific summary (e.g.
 * `{fromStage, toStage}` or a short note preview) — never full internal
 * note content duplicated verbatim beyond a short preview, and never
 * anything from CLAUDE.md §14's forbidden-to-expose list (prompts,
 * embeddings, chunks).
 */
export const leadActivity = pgTable("lead_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  type: leadActivityTypeEnum("type").notNull(),
  // Null actor = AI/system-driven (e.g. an AI-generated summary, an
  // automatic escalation) rather than a human action.
  actorUserId: uuid("actor_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LeadActivityEntry = typeof leadActivity.$inferSelect;
export type NewLeadActivityEntry = typeof leadActivity.$inferInsert;
