import { integer, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { leads } from "./leads";
import { organizations } from "./organizations";

/**
 * A scoring snapshot each time a lead's score is (re)computed — module
 * spec §4's signals, stored verbatim for transparency ("why is this lead a
 * 72?") and to support a future score-trend view. `leads.score` always
 * holds the latest value, denormalized for fast filtering/sorting; this
 * table is the append-only history behind it. See
 * modules/leads/scoring.ts for the signal shape and the (pure, deterministic)
 * formula that turns signals into a 0–100 total.
 */
export const leadScores = pgTable("lead_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  signals: jsonb("signals").notNull(),
  totalScore: integer("total_score").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LeadScoreEntry = typeof leadScores.$inferSelect;
export type NewLeadScoreEntry = typeof leadScores.$inferInsert;
