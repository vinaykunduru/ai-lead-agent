import "server-only";
import { and, eq } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { analyticsAlertRules, type AnalyticsAlertRule } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { getAiPerformance } from "./ai-performance-service";
import { getKnowledgeAnalytics } from "./knowledge-analytics-service";
import { getInboxAnalytics } from "./inbox-analytics-service";
import { getExecutiveDashboard } from "./executive-service";
import { getWidgetAnalytics } from "./widget-analytics-service";
import type { CreateAlertRuleInput, UpdateAlertRuleInput } from "./validation";

export async function listAlertRules(): Promise<AnalyticsAlertRule[]> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  return withRlsContext(session.userId, (tx) =>
    tx.select().from(analyticsAlertRules).where(eq(analyticsAlertRules.organizationId, session.organizationId)),
  );
}

export async function createAlertRule(input: CreateAlertRuleInput): Promise<AnalyticsAlertRule> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  const [rule] = await withRlsContext(session.userId, (tx) =>
    tx
      .insert(analyticsAlertRules)
      .values({
        organizationId: session.organizationId,
        name: input.name,
        metric: input.metric,
        operator: input.operator,
        threshold: input.threshold.toString(),
        enabled: input.enabled ?? true,
        createdBy: session.userId,
      })
      .returning(),
  );

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "analytics.alert_rule_created",
    resourceType: "analytics_alert_rule",
    resourceId: rule.id,
    metadata: { metric: rule.metric },
  });

  return rule;
}

export async function updateAlertRule(ruleId: string, input: UpdateAlertRuleInput): Promise<AnalyticsAlertRule> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  const patch: Partial<typeof analyticsAlertRules.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.metric !== undefined) patch.metric = input.metric;
  if (input.operator !== undefined) patch.operator = input.operator;
  if (input.threshold !== undefined) patch.threshold = input.threshold.toString();
  if (input.enabled !== undefined) patch.enabled = input.enabled;

  const [rule] = await withRlsContext(session.userId, (tx) =>
    tx
      .update(analyticsAlertRules)
      .set(patch)
      .where(and(eq(analyticsAlertRules.id, ruleId), eq(analyticsAlertRules.organizationId, session.organizationId)))
      .returning(),
  );
  if (!rule) throw new Error("Alert rule not found");

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "analytics.alert_rule_updated",
    resourceType: "analytics_alert_rule",
    resourceId: rule.id,
  });

  return rule;
}

export async function deleteAlertRule(ruleId: string): Promise<void> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  const [deleted] = await withRlsContext(session.userId, (tx) =>
    tx
      .delete(analyticsAlertRules)
      .where(and(eq(analyticsAlertRules.id, ruleId), eq(analyticsAlertRules.organizationId, session.organizationId)))
      .returning(),
  );
  if (!deleted) throw new Error("Alert rule not found");

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "analytics.alert_rule_deleted",
    resourceType: "analytics_alert_rule",
    resourceId: ruleId,
  });
}

export type AlertStatus = AnalyticsAlertRule & { currentValue: number; breached: boolean };

const ALERT_WINDOW_HOURS = 24;

/** Exported (not just internal) specifically so the threshold logic stays
 * unit-testable without any database — same reasoning as
 * modules/leads/scoring.ts's computeLeadScore. */
export function compare(value: number, operator: AnalyticsAlertRule["operator"], threshold: number): boolean {
  switch (operator) {
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
  }
}

/**
 * Configurable thresholds, detection only (module spec §10) — no email/
 * push/webhook delivery exists in this codebase (Email is explicitly out
 * of scope for this phase), so this just computes each enabled rule's
 * current value over the trailing 24h and reports whether it's breached,
 * for the UI to surface. Reuses every metric from the domain services
 * above rather than recomputing any of them.
 */
export async function evaluateAlerts(): Promise<AlertStatus[]> {
  const rules = await listAlertRules();
  const enabledRules = rules.filter((r) => r.enabled);
  if (enabledRules.length === 0) return [];

  const windowFilter = { from: new Date(Date.now() - ALERT_WINDOW_HOURS * 60 * 60 * 1000).toISOString() };

  const neededMetrics = new Set(enabledRules.map((r) => r.metric));
  const [aiPerf, knowledge, inbox, executive, widgetAnalytics] = await Promise.all([
    neededMetrics.has("failure_rate") || neededMetrics.has("avg_latency_ms") ? getAiPerformance(windowFilter) : null,
    neededMetrics.has("no_match_rate") ? getKnowledgeAnalytics(windowFilter) : null,
    neededMetrics.has("escalation_rate") ? getInboxAnalytics(windowFilter) : null,
    neededMetrics.has("escalation_rate") ? getExecutiveDashboard(windowFilter) : null,
    neededMetrics.has("bounce_rate") ? getWidgetAnalytics(windowFilter) : null,
  ]);

  const currentValueByMetric: Record<AnalyticsAlertRule["metric"], number> = {
    failure_rate: aiPerf?.failureRate ?? 0,
    avg_latency_ms: aiPerf?.avgLatencyMs ?? 0,
    no_match_rate: knowledge?.noMatchRate ?? 0,
    escalation_rate:
      inbox && executive && executive.totalConversations > 0
        ? Math.round((inbox.escalations / executive.totalConversations) * 1000) / 10
        : 0,
    bounce_rate: widgetAnalytics?.bounceRate ?? 0,
  };

  const enabledIds = new Set(enabledRules.map((r) => r.id));
  return rules.map((rule) => {
    if (!enabledIds.has(rule.id)) {
      return { ...rule, currentValue: 0, breached: false };
    }
    const currentValue = currentValueByMetric[rule.metric];
    return { ...rule, currentValue, breached: compare(currentValue, rule.operator, Number(rule.threshold)) };
  });
}
