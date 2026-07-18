# API Reference

All company-facing and platform-admin routes live under `src/app/api/**` as Next.js Route Handlers. Every route is thin: it parses/validates input with **Zod**, calls a service function in `modules/*/service.ts`, and maps thrown errors to an HTTP status via a shared helper. **The actual auth check (`requireCompanySession()`) and permission check (`assertPermission(session, "...")`) live inside the service function, not the route file** — this is deliberate (see [Authorization](../authorization/README.md)): it means every code path that reaches a service function is protected, regardless of which route (or future route) calls it.

- [Conventions](#conventions)
- [Leads](./leads.md) *(full endpoint reference + module doc)*
- [Conversations — Inspector](#conversations--inspector)
- [Inbox](#inbox)
- [Knowledge Base](#knowledge-base)
- [Widgets — company-side](#widgets--company-side)
- [Widget — public, unauthenticated](#widget--public-unauthenticated)
- [Analytics](#analytics)
- [AI Behaviour](#ai-behaviour)
- [Background jobs (Inngest)](#background-jobs-inngest)

## Conventions

### Error mapping

`apiError()` (`src/app/api/_lib/handle-error.ts`) maps thrown `Error` messages to HTTP status codes by prefix/suffix convention:

| Message pattern | Status | Example |
|---|---|---|
| starts with `"Unauthorized"` | 401 | no valid session |
| starts with `"Forbidden"` | 403 | thrown by `assertPermission`: `` Forbidden: missing permission "leads.view" `` |
| ends with `"not found"` | 404 | `"Lead not found"` |
| anything else | 400 | validation/business-rule errors |

Route files add their own pre-service-call checks: a failed Zod parse returns `400` directly from the route (not via `apiError`), and a path param that fails `z.string().uuid()` returns `404` before even calling the service — this avoids leaking whether a malformed ID "almost" matched something real.

### Tenant scoping

Every company-side route resolves the caller's organization **server-side** from their session (`requireCompanySession()` → the user's active `memberships` row) and never trusts an org id from the client. Queries additionally run through Postgres RLS via `withRlsContext(session.userId, ...)`. See [Authorization](../authorization/README.md) and [Database — RLS](../database/rls.md).

### Agent-role restriction

Several list/detail endpoints (Leads, Conversations, Inbox) apply an additional service-layer restriction for the `agent` role: an agent can only see leads/conversations that are unassigned or assigned to them. A request for a lead/conversation an agent isn't permitted to see returns **404**, not 403 — this avoids leaking that the resource exists at all to a party who shouldn't know.

### Response shape

Most endpoints return `{ <resourceName>: T }` or `{ <resourceName>Plural: T[] }` (e.g. `{ lead }`, `{ leads: [...] }`). A few return the payload directly, unwrapped — this is called out explicitly wherever it applies (conversation/inbox detail, playground, semantic search, widget public config). Mutations that create a resource return **201**; mutations that update return **200**; deletes return **204** with no body.

---

## Conversations — Inspector

Read-only developer/inspector tool for the company dashboard — distinct from **Inbox**, which is the agent-facing reply surface.

### `GET /api/conversations`
List conversations. Auth: company session. Permission: `conversations.view`.

Query: `{ widgetId?: uuid }`

Response `200`: `{ conversations: (Conversation & { widgetName: string, messageCount: number })[] }`

### `GET /api/conversations/:conversationId`
Full conversation detail. Auth: company session. Permission: `conversations.view`.

Response `200` (fields spread at top level, not nested under a key):
```json
{
  "conversation": { "...": "..." },
  "messages": [ "ConversationMessage[]" ],
  "citationsByMessageId": { "<messageId>": [ "Citation[]" ] },
  "usageByMessageId": { "<messageId>": "Usage" }
}
```
Errors: `404 { "error": "Conversation not found" }`.

---

## Inbox

Agent-facing surface for human takeover and replying to visitors.

### `GET /api/inbox`
Permission: `inbox.view`. Query: `{ view?: "all"|"assigned_to_me"|"unassigned"|"unread"|"needs_reply"|"escalated"|"closed" (default "all"), widgetId?: uuid }`. Response `200`: `{ conversations: InboxConversationItem[] }`.

### `GET /api/inbox/:conversationId`
Permission: `inbox.view`. Response `200`: `{ conversation, messages }` (spread, not nested). `404` if inaccessible.

### `POST /api/inbox/:conversationId/read`
Permission: `inbox.view`. No body. Marks the conversation read. `204`.

### `POST /api/inbox/:conversationId/reply`
Permission: `inbox.reply`. Body: `{ content: string (1–4000 chars) }`.

If the conversation wasn't already human-owned, this call **implicitly takes it over** in the same transaction (`owner: "human"`, `assignedUserId`, `takeoverReason: "manual"`) — you do not need to call `/takeover` first. The inserted message has `provider`/`model` left `null` (the way the schema distinguishes a human-authored message from an AI one). Response `201`: `{ message: ConversationMessage }`. The audit log entry stores only the `messageId`, never the reply content.

### `POST /api/inbox/:conversationId/resume`
Permission: `inbox.reply`. No body. Flips `conversations.owner` back to `"ai"` — the Conversation Engine checks only this field to decide whether to auto-reply. Response `200`: `{ conversation: Conversation }`.

### `POST /api/inbox/:conversationId/takeover`
Permission: `inbox.reply`. No body. Sets `owner: "human"`, `assignedUserId`, `takeoverReason: "manual"`, `takeoverAt`. Response `200`: `{ conversation: Conversation }`.

---

## Knowledge Base

See [Knowledge Base module docs](../knowledge-base/README.md) for the processing pipeline behind these endpoints.

### `GET /api/knowledge/collections`
Permission: `knowledge.view`. Response `200`: `{ collections: KnowledgeCollection[] }`.

### `POST /api/knowledge/collections`
Permission: `knowledge.create`. Body: `{ name: string (1–120 chars) }`. Response `201`: `{ collection }`.

### `PATCH /api/knowledge/collections/:collectionId`
Permission: `knowledge.update`. Body: `{ name?: string, status?: "active"|"archived" }` (`400` if both omitted). Response `200`: `{ collection }`.

### `DELETE /api/knowledge/collections/:collectionId`
Permission: `knowledge.delete`. **Soft delete** — the row is marked deleted, never hard-removed. `204`.

### `GET /api/knowledge/documents`
Permission: `knowledge.view`. Query: `{ collectionId?: uuid }`. Response `200`: `{ documents: PublicKnowledgeDocument[] }`.

### `POST /api/knowledge/documents`
Permission: `knowledge.create`. Three request shapes on the same endpoint:

| Content-Type / body | Path | Validation |
|---|---|---|
| `multipart/form-data` (`file`, `collectionId`, `title` fields) | file upload | `uploadFileMetadataSchema` — MIME restricted to PDF / `.docx`, max 20MB |
| JSON with a `url` key | website import | `createWebsiteDocumentSchema` — `url` must be `http(s)` |
| JSON, otherwise | plain text | `createTextDocumentSchema` — `content` ≤ 200,000 chars |

Response `201`: `{ document }`. Every path enqueues an Inngest processing job (see [Background jobs](#background-jobs-inngest)) — the document comes back `status: "pending"`.

### `GET /api/knowledge/documents/:documentId`
Permission: `knowledge.view`. Response `200`: `{ document, searchStats }`. `404` if not found.

### `PATCH /api/knowledge/documents/:documentId`
Permission: `knowledge.update`. Body: `{ title?: string, collectionId?: uuid, status?: "archived" }` — can archive and rename/move in the same call. `400 { error: "Nothing to update" }` if empty.

### `DELETE /api/knowledge/documents/:documentId`
Permission: `knowledge.delete`. Soft delete. `204`.

### `POST /api/knowledge/documents/:documentId/reprocess`
Permission: `knowledge.reprocess` (distinct from `knowledge.update`). No body. Enqueues the Inngest processing job again — does **not** reprocess inline. Response `200`: `{ ok: true }`.

### `POST /api/knowledge/search`
Permission: `knowledge.search` (distinct from `knowledge.view` — this triggers an embedding call). Body: `{ query: string (1–1000 chars), collectionId?: uuid, limit?: number (1–50) }`. Response `200`: the `SemanticSearchResult` object directly, **not** wrapped under a key.

---

## Widgets — company-side

### `GET /api/widgets`
Permission: `widget.view`. Response `200`: `{ widgets: Widget[] }`.

### `POST /api/widgets`
Permission: `widget.create`. Body: `{ name: string (1–100 chars), description?, defaultLanguage? }`. Also provisions an initial `widget_keys`, `widget_themes`, and `widget_settings` row. Response `201`: `{ widget }`.

### `GET /api/widgets/:widgetId`
Permission: `widget.view`. The single hydration call for the widget settings page — fetches the widget plus keys, domains, theme, and settings in parallel. Response `200`: `{ widget, keys, domains, theme, settings }`.

### `PATCH /api/widgets/:widgetId`
Body: `{ name?, description?, defaultLanguage?, status? }`. **`status` is split to a different permission**: if present, it's handled by `setWidgetStatus()` (permission `widget.publish`); any other fields go through `updateWidget()` (permission `widget.update`). Both can apply in one request if both are present. Response `200`: `{ widget }`.

### `DELETE /api/widgets/:widgetId`
Permission: `widget.delete`. Archives the widget (`status: "archived"`) — not a hard delete. `204`.

### `PATCH /api/widgets/:widgetId/appearance`
Permission: `widget.update`. Body: `primaryColor`/`accentColor` (hex), `launcherPosition` (enum), `launcherIcon`, `borderRadius` (0–48), `colorScheme` (enum), `font`, `logoUrl`/`avatarUrl` (URL or empty string to clear), `widgetWidth` (280–600), `widgetHeight` (400–900). Response `200`: `{ theme: WidgetTheme }`.

### `PATCH /api/widgets/:widgetId/behaviour`
Permission: `widget.update`. Body: `welcomeMessage`, `suggestedQuestions[]` (≤10), `showTypingIndicator`, `showBranding`, `offlineMessage`, `showTimestamp`, `showPoweredBy`, `autoOpen`, `autoOpenDelaySeconds` (0–120). Response `200`: `{ settings: WidgetSettings }`.

### `PATCH /api/widgets/:widgetId/domains`
Permission: `widget.update`. Body: `{ domains: [{ id?, domain, isEnabled }] }` (max 20) — full replace-the-list semantics; `domain` is a bare hostname (e.g. `example.com`, `localhost`). This is the allowlist the *public* widget endpoints check the caller's `Origin`/`Referer` against. Response `200`: `{ domains: WidgetDomain[] }`.

### `POST /api/widgets/:widgetId/keys/rotate`
Permission: `widget.update`. No body. Revokes the current key (kept for audit history, never deleted) and issues a new one in the same transaction. **This is the only response that will ever include the new key's full value** — there is no "reveal" endpoint afterward. Response `200`: `{ key: WidgetKey }`.

---

## Widget — public, unauthenticated

Called directly by the embed SDK running on a **third-party website** — no session, no cookie. Access is gated by three independent mechanisms instead:

1. **Public widget key** (`?key=` query param or JSON `key` field) resolves `widget_keys → widgets → organization`.
2. **Domain allowlist**: the caller's `Origin`/`Referer` host must match an enabled row in `widget_domains` for that widget.
3. **Rate limiting**: an in-memory, per-server-instance sliding window (`isRateLimited()`, keyed by `x-forwarded-for`, 60 requests / 60s). This is explicitly *not* a distributed limiter — it throttles per instance only, a known Phase-1 limitation (no Redis).

All four routes return `429 { "error": "Too many requests" }` when rate-limited, and collapse **every other rejection reason** (bad key, wrong domain, malformed input, DB error) into a single generic `400 { "error": "Invalid widget configuration request" }` — deliberately, so an anonymous caller can't learn which check failed. All routes echo `Access-Control-Allow-Origin: <request's own Origin>` + `Vary: Origin` on success and implement their own `OPTIONS` preflight handler.

### `GET /api/widget/config`
Query: `{ key: string }`. Response `200`: the public-safe `PublicWidgetConfig` DTO — `{ name, defaultLanguage, appearance: {...}, behaviour: {...} }`. **Never** includes `organizationId`, `widgetId`, knowledge base contents, AI configuration, embeddings, or any secret (see [`CLAUDE.md`](../../CLAUDE.md) §4).

### `POST /api/widget/messages`
Body: `{ key, visitorId: uuid, conversationId?: uuid, message: string (1–4000 chars) }`. `visitorId` is an SDK-generated, `localStorage`-persisted correlation token — not a credential. Runs the full [Conversation Engine execution pipeline](../ai/README.md#conversation-execution-pipeline) and **streams the reply back as Server-Sent Events** — the only streaming endpoint in the API. The SDK reads `response.body` manually and parses `data: {...}\n\n` framing (POST is used instead of a native `EventSource` because only POST can carry a request body).

### `GET /api/widget/conversations/:conversationId/messages`
Path: `conversationId` (uuid). Query: `{ key, after?: ISO datetime }`. A polling endpoint — the SDK calls it periodically while its panel is open, passing `after` as the timestamp of the newest message it already has. Response `200`: `{ messages: [...] }`.

### `GET /api/widget/sdk.js`
No key, no rate limiting, no `OPTIONS`. Returns the static embed script (`application/javascript`, `Cache-Control: public, max-age=300, stale-while-revalidate=3600`). The script is byte-identical for every widget — all per-widget behavior is fetched at runtime from `/api/widget/config?key=...`; nothing is baked in server-side per request.

---

## Analytics

Every endpoint is gated by `analytics.view` except export, gated by the distinct `analytics.export`. All share `analyticsFilterSchema`: `{ from?, to?, widgetId?, agentId?, stageId?, language?, provider? }` (all optional). No cross-tenant filter is ever accepted from the client.

| Endpoint | Method | Extra query params | Response |
|---|---|---|---|
| `/api/analytics/summary` | GET | — | `{ summary }` (executive dashboard) |
| `/api/analytics/leads` | GET | — | `{ analytics }` |
| `/api/analytics/conversations` | GET | `bucket: "hour"\|"day"\|"week"\|"month"` (default `day`) | `{ analytics }` |
| `/api/analytics/ai` | GET | — | `{ analytics }` |
| `/api/analytics/widgets` | GET | — | `{ analytics }` |
| `/api/analytics/inbox` | GET | — | `{ analytics }` |
| `/api/analytics/knowledge` | GET | — | `{ analytics }` |

### `GET /api/analytics/export`
Permission: `analytics.export`. Query: filter schema + `{ report: "executive"|"conversations"|"leads"|"ai"|"knowledge"|"inbox"|"widgets", format: "csv"|"json" (default "csv") }`. Returns a raw file body with dynamic `Content-Type`/`Content-Disposition: attachment`, not a JSON envelope.

### `GET /api/analytics/alerts`
Response `200`: `{ rules: AlertStatus[] }` — despite "evaluate" in the underlying function name, each returned rule includes its live current status.

### `POST /api/analytics/alerts`
Body: `{ name, metric: "failure_rate"|"avg_latency_ms"|"no_match_rate"|"escalation_rate"|"bounce_rate", operator: "gt"|"gte"|"lt"|"lte", threshold: number, enabled? }`. Note: gated by `analytics.view`, not a separate "manage" permission. Response `201`: `{ rule }`.

### `PATCH /api/analytics/alerts/:ruleId` · `DELETE /api/analytics/alerts/:ruleId`
Same permission (`analytics.view`). `PATCH` body is a partial of the create schema. `DELETE` → `204`.

### `GET /api/analytics/dashboard-preferences` · `PATCH /api/analytics/dashboard-preferences`
`PATCH` body: `{ cards: [{ key: <one of 10 fixed card keys>, visible: boolean, sortOrder: 0–100 }] }` (1–10 items, full replace). Response: `{ cards }`.

---

## AI Behaviour

Reads gated by `ai.view`, writes by `ai.update`, except Playground (`ai.test`). See [AI Behaviour module](../ai/README.md#ai-behaviour-module) for how these settings become the assembled system prompt.

| Endpoint | Methods | Notes |
|---|---|---|
| `/api/ai-behaviour/profile` | GET, PATCH | Large partial-update schema — assistant identity, personality, response settings, `aiProvider`, language config, `safetyFallbackMessage` |
| `/api/ai-behaviour/business-hours` | GET, PATCH | `workingDays[]`, `startTime`/`endTime` (`HH:MM` 24h), `timezone`, `holidayMode`, `outsideHoursResponse` |
| `/api/ai-behaviour/business-rules` | GET, PATCH | `PATCH` body: `{ rules: [{id?, text, isEnabled}] }` (max 50) — full replace-the-ordered-list |
| `/api/ai-behaviour/handoff` | GET, PATCH | `escalationEnabled`, `escalationEmail`, `escalationMessage`, `manualReviewRequired`, `maxAiAttempts` (1–10) |
| `/api/ai-behaviour/lead-questions` | GET, PATCH | `PATCH` body: `{ questions: [{id?, fieldKey, label, isRequired, placeholder?, validationType}] }` (max 30) — full replace |

### `POST /api/ai-behaviour/playground`
Permission: `ai.test`. Body: `{ message: string (1–2000), language?, personalityOverride?, renderer: <provider id> (default "openai") }`.

**Does not call a live AI provider.** This is a deterministic, clearly-labeled config *preview* — the response's `mockReply` is literally prefixed `"[Preview only — no AI provider is called in Phase 3]"`. It shows what the assembled prompt would look like for the current profile/business rules/lead questions/business hours merged with the request's overrides. Response `200` (unwrapped): `{ mockReply, promptPreview, renderedPrompt: { rendererId, text }, appliedLanguage, appliedPersonality, withinBusinessHours }`.

---

## Background jobs (Inngest)

### `/api/inngest` (GET, POST, PUT)
Not a normal application endpoint — this is the webhook Inngest's own infrastructure calls to discover and invoke registered functions, auto-generated by the `inngest/next` `serve()` helper. Auth/security is Inngest's own signing-key verification, not this app's session/permission system.

Currently registers one function: `processDocumentFunction` (`src/modules/knowledge/jobs.ts`), triggered by the `knowledge/document.process` event — enqueued whenever a document is created or reprocessed (see [Knowledge Base → processing pipeline](../knowledge-base/README.md#processing-pipeline--status-flow)).
