import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * Free-text rules a company sets for its AI ("Never discuss competitors",
 * "Never promise discounts", ...) — an ordered list per organization, not a
 * fixed enum, since companies phrase these however they like. The system
 * prompt generator includes only rules where isEnabled is true.
 */
export const aiBusinessRules = pgTable("ai_business_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiBusinessRule = typeof aiBusinessRules.$inferSelect;
export type NewAiBusinessRule = typeof aiBusinessRules.$inferInsert;
