import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * "Stages must be configurable per company" (module spec §1) — a real
 * per-org table, not a fixed enum, so a company can rename, reorder, add,
 * or remove stages. Every org is lazily seeded with 8 sensible defaults
 * (New, Qualified, Contacted, Meeting Scheduled, Proposal Sent, Won, Lost,
 * Archived) the first time its lead pipeline is touched — the same lazy
 * pattern as modules/knowledge's default collection.
 */
export const leadStages = pgTable("lead_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  // Terminal-stage markers drive dashboard metrics (conversion rate, won/
  // lost counts) without hardcoding stage names anywhere — a company that
  // renames "Won" to "Closed Won" doesn't break the metric.
  isWon: boolean("is_won").notNull().default(false),
  isLost: boolean("is_lost").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LeadStage = typeof leadStages.$inferSelect;
export type NewLeadStage = typeof leadStages.$inferInsert;
