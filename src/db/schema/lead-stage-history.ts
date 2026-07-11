import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { leadStages } from "./lead-stages";
import { leads } from "./leads";
import { organizations } from "./organizations";

/** Append-only stage-change history, backing the Pipeline/Kanban view and
 * dashboard conversion metrics. */
export const leadStageHistory = pgTable("lead_stage_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  previousStageId: uuid("previous_stage_id").references(() => leadStages.id, { onDelete: "set null" }),
  newStageId: uuid("new_stage_id")
    .notNull()
    .references(() => leadStages.id, { onDelete: "cascade" }),
  changedByUserId: uuid("changed_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LeadStageHistoryEntry = typeof leadStageHistory.$inferSelect;
export type NewLeadStageHistoryEntry = typeof leadStageHistory.$inferInsert;
