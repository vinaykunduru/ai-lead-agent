# Troubleshooting

This app has a consistent, documented pattern: several real production bugs did not reproduce in local dev, and some didn't even reproduce in a synthetic local production build — they were only conclusively diagnosable via real production logs or live browser DevTools inspection of the actual broken page. Keep that pattern in mind before concluding "works on my machine" means "works."

- [Build & typecheck issues](#build--typecheck-issues)
- [Database / connection issues](#database--connection-issues)
- [Supabase / auth issues](#supabase--auth-issues)
- [Knowledge base import / embedding issues](#knowledge-base-import--embedding-issues)
- [Widget issues](#widget-issues)
- [Inngest / background job issues](#inngest--background-job-issues)
- [Layout / CSS issues that only appear in production](#layout--css-issues-that-only-appear-in-production)

## Build & typecheck issues

### `tsc --noEmit` fails on `@hookform/resolvers`' zod adapter

Symptom: a TypeScript error inside `@hookform/resolvers`'s zod adapter, not in application code. Cause: `zod` was bumped past `4.0.x` — `@hookform/resolvers@5.4.0`'s adapter type-checks a literal `_zod.version.minor` against `0`, and zod `4.1.x+` breaks that check. Fix: keep `zod` pinned to `~4.0.17` (already the case in `package.json`); if you need to bump it, reproduce with `pnpm typecheck` first and check whether this was fixed upstream before widening the range.

### `pnpm why jsdom` shows `jsdom` even though it's not used

Not a bug — `jsdom` is only Vitest's own optional peer dependency for its (unused here) `jsdom` test environment, not application code. Website import extraction uses `linkedom` instead — see [`ERR_REQUIRE_ESM` in `/api/inngest`](#err_require_esm-crash-in-apiinngest) below for why.

## Database / connection issues

### `EMAXCONNSESSION` errors from the Supabase pooler

Symptom: intermittent request failures in production (first observed breaking `/app/ai-behaviour`), Vercel logs showing `EMAXCONNSESSION`. Cause: each Vercel serverless invocation gets its own `postgres()` client instance; `postgres.js` defaults to `max: 10` connections per instance, and many concurrent invocations exceeded the Supabase pooler's total `pool_size`. **Already fixed**: `src/db/client.ts` caps the client at `max: 1`. If this recurs at higher traffic, see [Operations → Connection pooling](../operations/README.md#connection-pooling) for the concurrency math to re-derive before changing `max` again.

### Local dev can't connect to Supabase (`ENOTFOUND` / connection refused)

Cause: using the "Direct connection" string instead of "Session pooler". The direct-connection hostname (`db.<ref>.supabase.co`) has only an IPv6 (AAAA) DNS record — no IPv4 record at all — so it fails to resolve on IPv4-only networks (common in sandboxes/containers/corporate networks) with a DNS error that looks credential-related but isn't. Fix: use the pooler URI (`aws-0-<region>.pooler.supabase.com`) — see [Getting Started](../getting-started/README.md#session-pooler-vs-direct-connection).

### `withRlsContext` queries return zero rows unexpectedly

Check, in order: (1) is the connection role actually granted `SET ROLE authenticated`? A custom restricted Postgres role needs this grant explicitly — Supabase's default `postgres` role has it. (2) Is the org suspended? `active_organization_ids()` excludes suspended orgs, so a suspended company's own members see nothing via the RLS path — this is correct behavior, not a bug (see [Authorization → Suspended organizations](../authorization/README.md#suspended-organizations)). (3) Does the table actually have the RLS policy you expect — check [Database → RLS](../database/rls.md#policy-matrix-by-table-group).

## Supabase / auth issues

### First-owner invite email link fails / redirect rejected

Cause: the `redirectTo` URL (`/auth/confirm`) isn't on Supabase's allowlist. Fix: Supabase dashboard → Authentication → URL Configuration → Redirect URLs, add both the local (`http://localhost:3000/auth/confirm`) and production URL.

### Invite emails stop arriving / "email rate limit exceeded"

Supabase's built-in email sending works out of the box but at a very low rate (a handful of sends per hour) on free-tier projects. Configure custom SMTP in Supabase for anything beyond light testing.

### `/auth/confirm` doesn't establish a session

Confirmed root cause (verified against a real Supabase project): which link format Supabase sends — `?token_hash=...&type=...` (server-visible) vs. `#access_token=...` (an implicit-flow hash fragment, which a server never receives at all per HTTP/URL spec) — depends on project configuration, not application code. `/auth/confirm` **must** stay a client-rendered page (`confirm-client.tsx`) for this reason — see [Authentication → Why `/auth/confirm` must be client-rendered](../authentication/README.md#why-authconfirm-must-be-client-rendered). If someone "simplifies" this into a Route Handler, it will silently break for any project sending the hash-fragment form.

## Knowledge base import / embedding issues

### A document is stuck in `status: "processing"` or `"failed"`

Check `/app/knowledge-base/documents/[documentId]` first — `errorMessage` is set on failure and distinguishes extraction failures (`embeddingStatus` stays `"pending"`) from embedding failures (`embeddingStatus: "failed"`). See [Knowledge Base → Processing pipeline](../knowledge-base/README.md#processing-pipeline--status-flow) for the exact status-field semantics. Then check the Inngest dashboard for the underlying job run/error. Use [`POST .../reprocess`](../api/README.md#post-apiknowledgedocumentsdocumentidreprocess) to retry — it resets both status fields and re-enqueues.

### Website import fails with a generic error

Common causes, in order of likelihood: the target isn't `text/html` (`content-type` check), the page is larger than 5MB, the fetch took longer than 15s, or the URL matched the SSRF guard's private/loopback hostname patterns (`localhost`, `127.*`, `10.*`, `172.16–31.*`, `192.168.*`, `169.254.*`, `::1`) — see [Knowledge Base → Website import safety](../knowledge-base/README.md#website-import-safety). Note this guard does **not** protect against DNS rebinding — that's a known, documented limitation, not something to "fix" by tightening the regex further.

### `ERR_REQUIRE_ESM` crash in `/api/inngest`

Historical bug, already fixed — documented here because the fix (`linkedom` instead of `jsdom`) is easy to accidentally revert. `jsdom`'s dependency tree repeatedly and unpredictably reintroduced ESM-only sub-dependencies that crashed the Inngest route in production three separate times across three unrelated subsystems, each fix invalidated by the next because jsdom's own sub-dependencies float on caret ranges. `linkedom` replaced it in `modules/knowledge/extraction/website.ts` — it has a minimal, stable dependency tree and ships genuine dual CJS/ESM exports, so it doesn't have this class of bug at all. **Do not reintroduce `jsdom` as an application dependency.**

## Widget issues

### Widget doesn't load on a customer's site

Check, in order: (1) is the widget `status: "active"`? A `draft`/`disabled`/`archived` widget's public config resolution fails. (2) Is the customer's domain in the widget's allowed-domains list (`/app/widget/[widgetId]/domains`), enabled? (3) Is the public key current — was it rotated recently without updating the embed snippet? All three failure modes return the same generic `400` by design (see [Widget → Security model](../widget/README.md#security-model)), so there's no way to tell which failed from the response alone — check each in the dashboard.

### Widget visitor gets "Too many requests"

The public rate limiter is in-memory, per-server-instance, 60 requests/60s per `x-forwarded-for` IP — likely either genuine abuse/a broken retry loop in a customer's integration, or (less likely) many visitors sharing one IP (corporate NAT). Not distributed across instances in Phase 1 — see [Operations → Performance](../operations/README.md#performance).

## Inngest / background job issues

`processDocumentFunction` retries twice on failure (`retries: 2`) before giving up. If jobs aren't running at all locally, confirm `/api/inngest` is reachable and, for local dev, that the Inngest dev server is pointed at it. In production, confirm `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` are set — without them the app can enqueue but Inngest's infrastructure can't authenticate the webhook callback.

## Layout / CSS issues that only appear in production

This app hit a genuinely subtle case worth knowing about: a `<main>` element without `min-width: 0` let a nested CSS Grid `fr`-track column collapse a card (which had `overflow-hidden`) to a literal `0 × Npx` box — content present in the DOM, just invisible, because `overflow-hidden`/`auto`/`scroll` makes an element's *automatic minimum size* resolve to `0` per the CSS Box Sizing spec. It reproduced in real production traffic but not reliably in `next dev` or even a first attempt at a synthetic local production build.

**If a page renders "empty" in a specific layout region despite data clearly loading**: open DevTools, check the computed box dimensions of the empty region before assuming it's a data-fetching bug. A `0 × Npx` computed box with real content stacked inside it (visible in the DOM but not laid out) is the signature of this exact collapse class, not a missing-data bug. The general fix is `min-w-0` on the flex/grid ancestor chain, and/or an explicit `minmax()` floor on the grid track — see `src/shared/components/dashboard-shell.tsx` and the conversation/lead detail page grids for the applied pattern.

Related: [Operations](../operations/README.md) · [Deployment](../deployment/README.md) · [Testing](../testing/README.md)
