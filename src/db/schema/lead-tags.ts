import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { leads } from "./leads";
import { organizations } from "./organizations";

/**
 * Free-text, company-specific tags (module spec §8) — no separate tag-
 * vocabulary table; a tag is just a string scoped to (organization, lead).
 * The 6 examples in the spec (Enterprise, Hot Lead, Sales, Support, VIP,
 * Spam) are illustrative starting points a company might type, not a fixed
 * enum a management screen would curate.
 */
export const leadTags = pgTable("lead_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
  createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LeadTag = typeof leadTags.$inferSelect;
export type NewLeadTag = typeof leadTags.$inferInsert;
