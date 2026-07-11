import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { leads } from "./leads";
import { organizations } from "./organizations";

/**
 * Append-only assignment/reassignment history (module spec §9). The lead's
 * CURRENT assignee is denormalized onto leads.assignedUserId for fast
 * filtering/sorting; this table is the audit trail of every change to it.
 * `changedByUserId` is null for a system/AI-driven assignment (none exist
 * yet in Phase 6 — always a human action today — but the column doesn't
 * assume that stays true).
 */
export const leadAssignments = pgTable("lead_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  previousAssigneeId: uuid("previous_assignee_id").references(() => authUsers.id, { onDelete: "set null" }),
  newAssigneeId: uuid("new_assignee_id").references(() => authUsers.id, { onDelete: "set null" }),
  changedByUserId: uuid("changed_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LeadAssignment = typeof leadAssignments.$inferSelect;
export type NewLeadAssignment = typeof leadAssignments.$inferInsert;
