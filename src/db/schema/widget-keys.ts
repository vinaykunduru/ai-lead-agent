import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { widgets } from "./widgets";

export const widgetKeyStatusEnum = pgEnum("widget_key_status", ["active", "revoked"]);

/**
 * The public key is the ONLY thing the embed snippet ever contains — see
 * CLAUDE.md §4. It is intentionally opaque and unrelated to `widgets.id`
 * (never derivable from it), so leaking a public key never reveals the
 * internal widget/organization id. Old keys are revoked, never deleted —
 * "Audit every rotation" requires the history to still exist. Exactly one
 * 'active' key per widget is enforced by a partial unique index (migration
 * 0009), the same pattern as memberships_one_active_org_per_user.
 */
export const widgetKeys = pgTable("widget_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  widgetId: uuid("widget_id")
    .notNull()
    .references(() => widgets.id, { onDelete: "cascade" }),
  publicKey: text("public_key").notNull().unique(),
  status: widgetKeyStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export type WidgetKey = typeof widgetKeys.$inferSelect;
export type NewWidgetKey = typeof widgetKeys.$inferInsert;
