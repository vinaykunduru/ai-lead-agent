import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * "Allow companies to customize dashboard cards" (module spec §11) — one
 * row per org (same singleton-config pattern as ai_business_hours),
 * storing which Executive Dashboard cards are visible and in what order.
 * Each entry is `{key, visible, sortOrder}`; `key` is validated against the
 * fixed set of card keys this phase actually renders
 * (modules/analytics/dashboard-preferences-service.ts) — never an
 * arbitrary string that could reference something that doesn't exist.
 */
export const dashboardPreferences = pgTable("dashboard_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  cards: jsonb("cards").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DashboardPreferences = typeof dashboardPreferences.$inferSelect;
export type NewDashboardPreferences = typeof dashboardPreferences.$inferInsert;
