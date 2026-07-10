import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { organizations } from "./organizations";

export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "platform_admin",
  "company_user",
  "system",
]);

/**
 * Append-only. No application code should ever UPDATE or DELETE a row here —
 * enforced at the database level by RLS (see db/migrations, no UPDATE/DELETE
 * policy is granted). See CLAUDE.md §6.
 */
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable: platform-level actions (e.g. "company created") are not scoped
  // to the organization being acted upon in the same way tenant data is.
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "set null",
  }),
  actorUserId: uuid("actor_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  actorType: auditActorTypeEnum("actor_type").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  // Safe metadata only — never secrets, tokens, or full request bodies.
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
