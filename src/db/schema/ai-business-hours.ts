import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * One row per organization. Hours are a single daily window ("09:00"-"17:00"
 * as plain "HH:MM" text, not a Postgres `time`) applied across
 * `workingDays` — deliberately not per-day-configurable hours, matching the
 * Phase 1 simplicity priority; most SaaS "business hours" widgets use this
 * same simple model.
 */
export const aiBusinessHours = pgTable("ai_business_hours", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  workingDays: jsonb("working_days").notNull().default(["mon", "tue", "wed", "thu", "fri"]),
  startTime: text("start_time").notNull().default("09:00"),
  endTime: text("end_time").notNull().default("17:00"),
  timezone: text("timezone").notNull().default("UTC"),
  holidayMode: boolean("holiday_mode").notNull().default(false),
  outsideHoursResponse: text("outside_hours_response"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiBusinessHours = typeof aiBusinessHours.$inferSelect;
export type NewAiBusinessHours = typeof aiBusinessHours.$inferInsert;
