import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { leads } from "./leads";
import { organizations } from "./organizations";

/**
 * Internal-only — module spec §7: "Internal only. Never visible to
 * visitors. Fully audited." Never referenced by anything the widget SDK or
 * any public endpoint can read; only company-authenticated, RLS-scoped
 * access (modules/leads/notes-service.ts). Every create/delete is audit-
 * logged (CLAUDE.md §6) and mirrored into lead_activity for the timeline.
 */
export const leadNotes = pgTable("lead_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  leadId: uuid("lead_id")
    .notNull()
    .references(() => leads.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LeadNote = typeof leadNotes.$inferSelect;
export type NewLeadNote = typeof leadNotes.$inferInsert;
