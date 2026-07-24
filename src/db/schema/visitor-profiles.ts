import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * A visitor's durable identity, org-scoped (not widget-scoped) — the same
 * person can appear on any of the org's widgets, and future channels
 * (WhatsApp, email, voice) are expected to resolve into this same table
 * rather than each growing their own contact record. See CLAUDE.md §8: this
 * is exactly the kind of schema-level room the "don't paint the schema into
 * a corner" rule anticipates, now actually needed.
 *
 * Identity + qualification fields are plain columns, not jsonb, because
 * they need to be searched/filtered directly (Leads search, Customer 360) —
 * unlike `leads.aiSummary`, which is read as a whole and never queried by
 * field. AI-generated fields (intent/sentiment/summary/next action) are
 * plain columns for the same reason.
 *
 * Deliberately does NOT store leadScore/qualificationStatus — those live on
 * `leads` only (there is at most one active lead per visitor profile, see
 * modules/leads/auto-service.ts), so a Customer 360 view reads them through
 * the active lead rather than duplicating them here.
 *
 * "Same phone/email -> same visitor" (Visitor Recognition) is enforced at
 * the database layer by two partial unique indexes hand-written into
 * migration 0017, same pattern as widget_keys_one_active_per_widget —
 * Drizzle's schema-level partial-index API isn't used elsewhere in this
 * codebase, so this file stays a plain table for consistency.
 */
export const visitorProfiles = pgTable("visitor_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  name: text("name"),
  phone: text("phone"),
  email: text("email"),
  company: text("company"),
  designation: text("designation"),
  industry: text("industry"),
  website: text("website"),
  city: text("city"),
  country: text("country"),

  interestedService: text("interested_service"),
  requirement: text("requirement"),
  budget: text("budget"),
  timeline: text("timeline"),
  teamSize: text("team_size"),
  currentSolution: text("current_solution"),
  preferredContactTime: text("preferred_contact_time"),

  // AI-generated — refreshed by the background extraction pass
  // (modules/conversation/extraction/stage2.ts), never by the visitor
  // directly.
  intent: text("intent"),
  sentiment: text("sentiment"),
  conversationSummary: text("conversation_summary"),
  nextRecommendedAction: text("next_recommended_action"),
  lastExtractedAt: timestamp("last_extracted_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type VisitorProfile = typeof visitorProfiles.$inferSelect;
export type NewVisitorProfile = typeof visitorProfiles.$inferInsert;
