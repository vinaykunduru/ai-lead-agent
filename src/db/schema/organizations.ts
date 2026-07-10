import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const organizationStatusEnum = pgEnum("organization_status", [
  "trial",
  "active",
  "suspended",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  website: text("website"),
  industry: text("industry"),
  timezone: text("timezone").notNull().default("UTC"),
  status: organizationStatusEnum("status").notNull().default("trial"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
