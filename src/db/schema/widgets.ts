import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { organizations } from "./organizations";

export const widgetStatusEnum = pgEnum("widget_status", ["draft", "active", "disabled", "archived"]);

/**
 * A company can create multiple widgets (e.g. one per site/brand). `status`
 * is the single source of truth for lifecycle — "enable"/"disable"/
 * "publish" are all just transitions of this field (see
 * modules/widget/widgets-service.ts), not a separate boolean that could
 * drift out of sync with it. No DELETE policy in RLS: "Delete Widget"
 * (the API's DELETE endpoint) sets status to 'archived', the same
 * soft-delete-via-status pattern already used for
 * knowledge_documents/knowledge_collections.
 */
export const widgets = pgTable("widgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  status: widgetStatusEnum("status").notNull().default("draft"),
  defaultLanguage: text("default_language").notNull().default("en"),
  createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Widget = typeof widgets.$inferSelect;
export type NewWidget = typeof widgets.$inferInsert;
