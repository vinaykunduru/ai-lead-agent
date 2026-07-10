import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";

/**
 * Platform admins are deliberately NOT an organization membership — see
 * CLAUDE.md §3.7. A row here means the user can access /admin; it carries no
 * organization_id and grants no implicit access to any tenant's data (tenant
 * data access for platform admin flows goes through explicit service-role
 * queries in the platform-admin module, not through this table's presence).
 */
export const platformAdmins = pgTable("platform_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type NewPlatformAdmin = typeof platformAdmins.$inferInsert;
