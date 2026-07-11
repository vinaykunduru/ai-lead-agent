import { z } from "zod";

/**
 * Shared filter shape across every analytics report (module spec §8: Date
 * Range, Widget, Agent, Lead Stage, Language, Provider). Deliberately no
 * "Company" filter — this module lives entirely under the company
 * dashboard (RLS + session already fix the organization; CLAUDE.md §3
 * forbids ever accepting a tenant identifier from the client), so a
 * cross-company selector belongs to a future Platform Admin analytics
 * surface, not here.
 */
export const analyticsFilterSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  widgetId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  stageId: z.string().uuid().optional(),
  language: z.string().trim().max(20).optional(),
  provider: z.string().trim().max(30).optional(),
});
export type AnalyticsFilter = z.infer<typeof analyticsFilterSchema>;

export const CONVERSATION_BUCKETS = ["hour", "day", "week", "month"] as const;
export const conversationSeriesQuerySchema = analyticsFilterSchema.extend({
  bucket: z.enum(CONVERSATION_BUCKETS).default("day"),
});
export type ConversationSeriesQuery = z.infer<typeof conversationSeriesQuerySchema>;

export const ANALYTICS_ALERT_METRICS = [
  "failure_rate",
  "avg_latency_ms",
  "no_match_rate",
  "escalation_rate",
  "bounce_rate",
] as const;
export const ANALYTICS_ALERT_OPERATORS = ["gt", "gte", "lt", "lte"] as const;

export const createAlertRuleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  metric: z.enum(ANALYTICS_ALERT_METRICS),
  operator: z.enum(ANALYTICS_ALERT_OPERATORS),
  threshold: z.number().finite(),
  enabled: z.boolean().optional(),
});
export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;

export const updateAlertRuleSchema = createAlertRuleSchema.partial();
export type UpdateAlertRuleInput = z.infer<typeof updateAlertRuleSchema>;

export const DASHBOARD_CARD_KEYS = [
  "totalConversations",
  "activeConversations",
  "leadsGenerated",
  "conversionRate",
  "humanTakeovers",
  "aiResolutionRate",
  "avgResponseTimeMs",
  "avgConversationLength",
  "csat",
  "estimatedCostUsd",
] as const;

const dashboardCardSchema = z.object({
  key: z.enum(DASHBOARD_CARD_KEYS),
  visible: z.boolean(),
  sortOrder: z.number().int().min(0).max(100),
});
export const updateDashboardPreferencesSchema = z.object({
  cards: z.array(dashboardCardSchema).min(1).max(DASHBOARD_CARD_KEYS.length),
});
export type UpdateDashboardPreferencesInput = z.infer<typeof updateDashboardPreferencesSchema>;

export const EXPORT_REPORTS = [
  "executive",
  "conversations",
  "leads",
  "ai",
  "knowledge",
  "inbox",
  "widgets",
] as const;
export const EXPORT_FORMATS = ["csv", "json"] as const;
export const exportQuerySchema = analyticsFilterSchema.extend({
  report: z.enum(EXPORT_REPORTS),
  format: z.enum(EXPORT_FORMATS).default("csv"),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;
