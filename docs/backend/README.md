# Backend

Server-side module structure. For the full request lifecycle and how this fits the three-surface architecture, see [Architecture](../architecture/README.md).

## Data Access Layer (DAL)

Next.js's own recommended pattern: **database access, service-role usage, and vendor API keys live only in `modules/*/service.ts` (and `db/queries` where a module has one), each marked `import "server-only"` at the top.** Server Components, Server Actions, and Route Handlers call into this layer — none of them hold a Supabase/Drizzle client or a secret directly.

```ts
import "server-only";
// modules/leads/service.ts
export async function listLeads(filters: LeadFilters): Promise<Lead[]> {
  const session = await requireCompanySession();
  assertPermission(session, "leads.view");
  return withRlsContext(session.userId, (tx) => /* query */);
}
```

Every service function follows the same shape: resolve the session, assert the permission, run the query through `withRlsContext` (or, in the four documented service-role contexts, the plain `db` client) — see [Database — RLS](../database/rls.md#which-postgres-role-runs-which-query).

## Module boundaries

Each module in `src/modules/` owns its own tables, validation, and service functions — other modules call into it through its exported service functions, never by importing its schema and querying directly. See [Architecture — Module map](../architecture/README.md#module-map) for what each of the 11 modules owns.

A module directory only contains the files it actually needs (`CLAUDE.md` §2 — no empty placeholder files):

```
modules/<name>/
  validation.ts       # Zod schemas for this module's inputs
  service.ts           # or <name>-service.ts, or split by sub-domain
                        # (e.g. widget/keys-service.ts, widget/domains-service.ts)
  types.ts              # if the module needs types beyond what Drizzle infers
```

## Route Handlers

`src/app/api/**/route.ts` — deliberately thin. A route file's job is: parse/validate the request with Zod, call exactly one service function, and map the result/error to a response. All auth and permission checks happen inside the service function it calls, not in the route file — see [API Reference — Conventions](../api/README.md#conventions) for the full error-mapping convention (`apiError()`).

## Server Actions

Used where a page's own form doesn't need a durable JSON API (e.g. Platform Admin company management). Per Next.js 16 and `CLAUDE.md` §9, **every Server Action re-verifies auth and permission itself** — a page-level `requireCompanySession()` in a layout does not extend to the Server Actions defined within pages under it, since Server Actions are independently POST-reachable. Server Action return values are minimal DTOs — only what the UI needs, never a raw Drizzle row.

## Providers

External services (AI, embeddings, storage, jobs) are never called directly from a module's service function — they go through `src/providers/*`, a thin interface per vendor category. See [Architecture — Provider abstractions](../architecture/README.md#provider-abstractions) and [AI — Providers](../ai/README.md#providers).

## Background jobs

The only asynchronous work in Phase 1 (knowledge document processing) runs through Inngest via `providers/jobs`' `enqueueJob()` — never a hand-rolled queue or Redis (`CLAUDE.md` §2). See [Knowledge Base — Processing pipeline](../knowledge-base/README.md#processing-pipeline--status-flow).

Related: [Architecture](../architecture/README.md) · [Authorization](../authorization/README.md) · [API Reference](../api/README.md)
