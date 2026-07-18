# Testing

Test runner: **Vitest** (`vitest.config.ts`), run via `pnpm test`.

## Test strategy

Two categories, both real by design — this app has a strong, hard-earned preference against mocking (see the RLS/production-bug lessons in [Troubleshooting](../troubleshooting/README.md)):

1. **Unit tests** — colocated next to the code they test (`src/modules/**/*.test.ts`, `src/providers/**/*.test.ts`). Pure logic: chunking, scoring, prompt rendering, permission checks, SSE parsing, CSV export, validation schemas. No network, no database.
2. **Integration tests** — `src/test/integration/*.test.ts`. Exercise **real Postgres RLS against a live Supabase project** — no mocked database, no mocked RLS. This is a deliberate, repeatedly-reaffirmed choice: a mocked-database test can pass while the real RLS policy is broken, which defeats the entire point of testing tenant isolation.

## Cross-tenant isolation tests

The mandatory minimum bar from [`CLAUDE.md`](../../CLAUDE.md) §7, one integration file per tenant-data module:

| File | Covers |
|---|---|
| `tenant-isolation.test.ts` | Core: organizations, memberships, platform admins |
| `knowledge-tenant-isolation.test.ts` | Knowledge Base |
| `ai-behaviour-tenant-isolation.test.ts` | AI Behaviour config |
| `widget-tenant-isolation.test.ts` | Widget Platform |
| `conversation-tenant-isolation.test.ts` | Conversation Engine |
| `leads-tenant-isolation.test.ts` | Leads / Inbox |
| `analytics-tenant-isolation.test.ts` | Analytics |
| `auth-flows.test.ts` | Login, invite, suspended-org behavior |
| `website-import-verification.test.ts` | SSRF guard + Readability extraction against real URLs |

`tenant-isolation.test.ts` creates two organizations and two users and asserts, matching CLAUDE.md §7's mandatory cases:

- An RLS-scoped query only ever returns the caller's own org/memberships.
- **(C)/(D)** cross-tenant `UPDATE` and `DELETE` are both rejected.
- **(E)** inserting a tenant-owned row while in another org's RLS context is rejected.
- **(F)** suspending a company blocks its own members' RLS-scoped reads.
- **(G)/(I)** an RLS context bound to an unrecognized user id returns nothing, not an error.
- **(H)** the service-role bypass is explicit and demonstrated side-by-side with the RLS-scoped path.
- **(J)** concurrent `withRlsContext` calls never see each other's claims.
- The one-active-org-per-user constraint rejects a second active membership.
- Granting/revoking a `platform_admins` row takes effect immediately.

### Running the isolation suite

1. Use a **disposable/staging** Supabase project — never production.
2. Set `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` in `.env.local` (or real env vars — `pnpm test` reads `process.env` directly; `.env.local` works because Next's env loading also applies to the CLI context Vitest shares).
3. Apply migrations against that project first: `pnpm db:migrate`.
4. `pnpm test`.

**Without the vars above, this suite skips** (reported as `skipped`, not `passed`) rather than failing — a skip is a signal isolation hasn't been verified in that environment, not proof that it works. Treat a skip in CI or locally as "not yet verified," never as a pass.

On **Node.js 20**, also set `NODE_OPTIONS=--experimental-websocket` when running `pnpm test` locally — `@supabase/supabase-js`'s realtime client requires a global `WebSocket`, which Node 20 doesn't provide without that flag (Node 22+ doesn't need it; CI uses Node 22 for this reason). This is unrelated to RLS itself.

### CI

`.github/workflows/ci.yml` only runs this suite for real if `TEST_DATABASE_URL`, `TEST_SUPABASE_SERVICE_ROLE_KEY`, `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY` are configured as repository secrets pointing at a disposable project; otherwise it skips there too, same as local.

## Adding a new tenant-data module

Per [`CLAUDE.md`](../../CLAUDE.md) §7, every module that reads or writes tenant data needs its own isolation test covering, at minimum:

- Company A cannot read/write Company B's data via any tenant-scoped endpoint.
- Company users cannot reach `/admin` or any platform-admin API.
- Suspended company users are blocked from `/app` and its APIs.
- Viewer role cannot perform any write action.
- Agent role cannot access leads/conversations not assigned to them (where applicable).

## Running everything

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # ESLint CLI
pnpm test        # unit + integration (isolation tests skip without DB env)
pnpm build       # production build — catches issues typecheck/dev don't (see Troubleshooting)
```

A change is not "verified" until all four pass — typecheck and lint catch a different class of bug than a real production build does (see [Troubleshooting → production-only bugs](../troubleshooting/README.md)).
