import { boolean, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { organizations } from "./organizations";

/**
 * The set of metrics an alert can watch — deliberately a fixed enum of
 * metrics this module already computes elsewhere (modules/analytics/*),
 * not a free-form expression language. Covers every example in the module
 * spec ("Spike in failures" -> failureRate, "High latency" -> avgLatencyMs,
 * "Provider unavailable" -> failureRate scoped to a recent window,
 * "Knowledge miss rate" -> noMatchRate) plus two more useful across the
 * Inbox/Widget domains this phase also reports on.
 */
export const analyticsAlertMetricEnum = pgEnum("analytics_alert_metric", [
  "failure_rate",
  "avg_latency_ms",
  "no_match_rate",
  "escalation_rate",
  "bounce_rate",
]);

export const analyticsAlertOperatorEnum = pgEnum("analytics_alert_operator", ["gt", "gte", "lt", "lte"]);

/**
 * Configurable thresholds (module spec §10). Detection-only: evaluating a
 * rule against the last 24h of data and surfacing its breach status in the
 * UI (modules/analytics/alerts-service.ts) — there is no email/push/webhook
 * delivery here, since Email is explicitly in this phase's DO-NOT-BUILD
 * list and no other notification channel exists in this codebase yet.
 */
export const analyticsAlertRules = pgTable("analytics_alert_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  metric: analyticsAlertMetricEnum("metric").notNull(),
  operator: analyticsAlertOperatorEnum("operator").notNull(),
  threshold: numeric("threshold", { precision: 12, scale: 4 }).notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AnalyticsAlertRule = typeof analyticsAlertRules.$inferSelect;
export type NewAnalyticsAlertRule = typeof analyticsAlertRules.$inferInsert;
