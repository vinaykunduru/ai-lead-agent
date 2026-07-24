import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { conversations } from "./conversations";
import { leadStages } from "./lead-stages";
import { organizations } from "./organizations";
import { visitorProfiles } from "./visitor-profiles";
import { widgets } from "./widgets";

export const leadPriorityEnum = pgEnum("lead_priority", ["low", "medium", "high", "urgent"]);

/**
 * AI-determined, from context (conversation depth, intent, budget/timeline
 * mentions, buying signals) — not a pure threshold on `score`, per the
 * Visitor Profile & Lead Qualification module spec. Set by
 * modules/leads/auto-service.ts's background extraction, editable by staff
 * the same way `priority` already is.
 */
export const leadQualificationStatusEnum = pgEnum("lead_qualification_status", ["cold", "warm", "hot"]);

/**
 * `aiSummary` is structured JSON (module spec §3: "Store structured JSON.
 * Not free-form text only"), shaped by modules/leads/ai-summary.ts's
 * LeadAiSummary type — kept as jsonb rather than a fully normalized set of
 * columns since it's read as a whole, never queried/filtered by its
 * individual fields.
 */
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  widgetId: uuid("widget_id").references(() => widgets.id, { onDelete: "set null" }),
  // Originating conversation only — kept exactly as before (still uniquely
  // constrained, migration 0013). A visitor's *full* conversation history is
  // derived by joining conversation_sessions.visitorProfileId, not stored
  // here; see modules/leads/auto-service.ts.
  conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  // Nullable, no backfill (Visitor Profile module spec) — older leads keep
  // working exactly as before via their own inline name/email/phone/company.
  visitorProfileId: uuid("visitor_profile_id").references(() => visitorProfiles.id, { onDelete: "set null" }),
  stageId: uuid("stage_id")
    .notNull()
    .references(() => leadStages.id, { onDelete: "restrict" }),
  assignedUserId: uuid("assigned_user_id").references(() => authUsers.id, { onDelete: "set null" }),

  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  location: text("location"),
  source: text("source").notNull().default("widget"),

  priority: leadPriorityEnum("priority").notNull().default("medium"),
  score: integer("score").notNull().default(0),
  qualificationStatus: leadQualificationStatusEnum("qualification_status"),
  aiSummary: jsonb("ai_summary"),

  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
