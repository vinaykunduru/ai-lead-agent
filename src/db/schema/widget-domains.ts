import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { widgets } from "./widgets";

/**
 * Allowlisted embed origins for a widget. `domain` is a normalized bare
 * hostname (no scheme, no path, no port unless the company genuinely needs
 * one for local/dev embedding) — see modules/widget/validation.ts for the
 * exact normalization/validation rule this table trusts on write.
 */
export const widgetDomains = pgTable("widget_domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  widgetId: uuid("widget_id")
    .notNull()
    .references(() => widgets.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WidgetDomain = typeof widgetDomains.$inferSelect;
export type NewWidgetDomain = typeof widgetDomains.$inferInsert;
