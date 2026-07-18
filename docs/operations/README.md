# Operations

## Monitoring

- **Sentry** — captures unhandled exceptions across the app (client and server), when `NEXT_PUBLIC_SENTRY_DSN` is configured. First place to check after a deploy or an incident report.
- **Vercel logs** — real-time function logs for every Route Handler/Server Action invocation. Production incidents in this app have consistently first surfaced here, not in local testing — see [Connection pooling](#connection-pooling) below for a concrete example.
- **Inngest dashboard** — job run history, retries, and failures for document processing. A document stuck in `status: "processing"` for an unusual length of time is visible here before it's visible anywhere else.
- **Supabase dashboard** — database connection count, query performance, and Auth logs.

## Connection pooling

The single most important operational constraint in this app, already hit once in production: `src/db/client.ts` caps each `postgres()` client instance at `max: 1` connection, specifically because Vercel's serverless model spins up many concurrent function instances, each getting its own client — at the previous default (`max: 10`), modest concurrent traffic exhausted Supabase's pooler (`pool_size: 15`), surfacing as `EMAXCONNSESSION` errors that broke real pages in production (first observed on `/app/ai-behaviour`).

If this recurs: check the Supabase dashboard's connection count first. Raising the pooler's `pool_size` in Supabase is the other lever besides the per-instance `max` — both change the same ceiling from different sides. Don't set `max` back above 1 without re-deriving the concurrency math (expected concurrent Vercel invocations × `max` must stay under the pooler's `pool_size`).

## Error handling in the AI pipeline

The [conversation execution pipeline](../ai/README.md#conversation-execution-pipeline) never leaks a raw AI provider error to a visitor — provider failures are caught, the assistant message is marked `status: "error"` with a truncated safe message, and the visitor sees a generic error event. Check Sentry / Vercel logs (not the widget UI) to diagnose an actual provider outage or misconfiguration.

Similarly, [knowledge document processing](../knowledge-base/README.md#processing-pipeline--status-flow) never throws past its own boundary — a failure sets `status: "failed"` (and/or `embeddingStatus: "failed"`) with an `errorMessage` visible on the document detail page (`/app/knowledge-base/documents/[documentId]`) rather than crashing the Inngest job silently. That page is the first place to check for a stuck or failed import.

## Performance

- Postgres `postgres.js` client is capped per-instance (see above) — this is a concurrency ceiling, not a query-performance setting.
- pgvector HNSW index on `knowledge_chunks.embedding` keeps semantic search sub-linear as a knowledge base grows; there's no separate reindexing job — HNSW updates incrementally as chunks are inserted.
- Conversation history sent to the AI provider is capped (`MAX_HISTORY_TOKENS = 3000` / `MAX_HISTORY_MESSAGES = 20`) specifically to bound per-message latency and cost as a conversation grows long — see [AI → Conversation history budget](../ai/README.md#conversation-history-budget).
- The public widget rate limiter is in-memory per server instance (not distributed) — under real multi-instance production load this means the *effective* combined rate limit across all instances is higher than the configured 60/60s per instance. This is a documented Phase-1 limitation, not a bug; a distributed limiter would require Redis, which is explicitly out of scope for Phase 1 (`CLAUDE.md` §2).

## Backups

Database backups are Supabase's managed responsibility (point-in-time recovery availability depends on the Supabase plan tier) — this app does not run its own backup job. Confirm the project's backup/PITR settings in the Supabase dashboard match the business's actual data-loss tolerance; this has not been independently verified as part of this documentation pass.

## Disaster recovery

- **Database**: restore from a Supabase backup/PITR snapshot, then re-run any migrations applied after that snapshot (`pnpm db:migrate`).
- **Application**: redeploy from any prior Vercel deployment (Vercel retains build artifacts) — no application-level state lives outside the database and Supabase Storage.
- **Background jobs**: Inngest retries failed function runs automatically (`retries: 2` on `processDocumentFunction`); a document stuck in `pending`/`processing` after an outage can be recovered by calling [`POST /api/knowledge/documents/:documentId/reprocess`](../api/README.md#post-apiknowledgedocumentsdocumentidreprocess), which re-enqueues the same event.

## Incident response

1. Check Sentry for the exception, Vercel logs for the request context, and (for anything DB-shaped) the Supabase dashboard's connection/query metrics.
2. Reproduce against a real production build (`pnpm build && pnpm start`) if it doesn't reproduce in `next dev` — this app has a track record of bugs (connection pooling, a CSS Grid collapse, ESM-only dependency crashes) that only manifest under production conditions. See [Troubleshooting](../troubleshooting/README.md).
3. If the incident involves tenant data crossing an organization boundary, treat it as critical regardless of apparent severity — re-verify the relevant [cross-tenant isolation test](../testing/README.md#cross-tenant-isolation-tests) passes before and after any fix.
4. Ship the fix through the normal [deployment checklist](../deployment/README.md#production-checklist) — do not hotfix directly against production infrastructure outside the normal pipeline.

Related: [Deployment](../deployment/README.md) · [Troubleshooting](../troubleshooting/README.md) · [Security](../security/README.md)
