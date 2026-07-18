# Analytics

## Purpose

Business intelligence across conversations, leads, widgets, and AI performance for a single organization — the executive-facing view of how the AI assistant is actually performing.

## Features

- Executive dashboard (summary KPIs, customizable card layout)
- 7 aggregation domains: executive summary, leads, conversations (time-bucketed), AI performance, widgets, inbox, knowledge base
- Alert rules on live metrics (e.g. failure rate above a threshold)
- CSV/JSON export per report
- Per-user dashboard card preferences (visibility + order)

## Roles

| Role | View | Export |
|---|:---:|:---:|
| `owner`, `admin`, `manager` | ✅ | ✅ |
| `viewer` | ✅ | — |
| `agent` | — | — |

Permissions: `analytics.view`, `analytics.export`. Note: creating/editing/deleting an alert rule is gated by `analytics.view`, not a separate "manage" permission — a deliberate choice, not an oversight (see [API Reference](../api/README.md#analytics)).

## Workflow

All 7 aggregation services share one filter shape (`from`, `to`, `widgetId`, `agentId`, `stageId`, `language`, `provider` — all optional) and are always scoped to the caller's own organization; no cross-tenant filter is ever accepted from the client. Alert rules are evaluated live on read — `GET /api/analytics/alerts` returns each rule's *current* status, not a stored historical firing log.

## Screens

`/app/analytics` — tabbed by domain (Overview, Leads, Conversations, AI, Widgets, Inbox, Knowledge Base), plus an Alerts panel and per-user dashboard customization.

## Related APIs

[Analytics endpoints](../api/README.md#analytics)

## Database tables

`analytics_alert_rules`, `dashboard_preferences` — the two tables this module *owns*. Every other table it aggregates from (`leads`, `conversations`, `conversation_messages`, `knowledge_documents`, etc.) belongs to its respective module; Analytics reads across them rather than duplicating data. See [Database → Analytics](../database/README.md#analytics).

Related: [Leads](../api/leads.md) · [Conversations](../conversations/README.md) · [AI pipeline](../ai/README.md)
