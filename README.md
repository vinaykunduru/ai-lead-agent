# AI Lead Agent

Multi-tenant AI Lead Follow-Up Platform — Phase 1: Platform Admin, Company
Dashboard, and the embedded website widget scaffold. See [CLAUDE.md](./CLAUDE.md)
for the permanent architecture and security rules, and read it before making
changes.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · Tailwind CSS ·
shadcn/ui · Supabase (Postgres, Auth, Storage) · pgvector · Drizzle ORM · Zod ·
React Hook Form · Sentry · pnpm.

## Setup

1. **Create a Supabase project** (free tier is fine to start): https://supabase.com/dashboard
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API
   - `DATABASE_URL` — Project Settings → Database → Connection string. **Use
     the "Session pooler" URI, not "Direct connection".** The direct
     connection hostname (`db.<ref>.supabase.co`) only has an IPv6 (AAAA)
     DNS record — no IPv4 record exists for it at all — so it fails to
     resolve on any IPv4-only network (many sandboxes, containers, and
     corporate networks included) with a plain DNS `ENOTFOUND`/connection
     error that has nothing to do with the credentials being wrong. The
     pooler hostname (`aws-0-<region>.pooler.supabase.com`) is IPv4-reachable.
     Separately: the role in this connection string must be able to
     `SET ROLE authenticated` — Supabase's default `postgres` connection role
     can; if you've created a custom restricted role for this, it needs that
     grant too (see `src/db/client.ts`'s `withRlsContext`).
   - `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for local dev
   - AI/embeddings/job provider keys are optional until the Knowledge Base
     and AI Behaviour modules are built (later phase) — leave them blank for
     now.
3. **Allow the invite-confirmation redirect.** In the Supabase dashboard:
   Authentication → URL Configuration → Redirect URLs, add
   `http://localhost:3000/auth/confirm` (and your production
   `https://<domain>/auth/confirm` once deployed). Supabase rejects
   `redirectTo` URLs that aren't on this allowlist — without this step, the
   first-owner invite email link will fail.
4. Install dependencies:
   ```bash
   pnpm install
   ```
5. Apply the database migrations (creates tables, enables RLS, and adds the
   one-active-org-per-user constraint — see `src/db/migrations`):
   ```bash
   pnpm db:migrate
   ```
6. **Create your first platform admin manually.** There's no UI for this by
   design (platform admin is not a self-serve role): in the Supabase SQL
   editor, after signing up or creating a user in Authentication → Users, run:
   ```sql
   insert into platform_admins (user_id) values ('<the user''s auth.users id>');
   ```
7. Run the dev server:
   ```bash
   pnpm dev
   ```
   Visit `http://localhost:3000`, sign in as your platform admin, and you'll
   land on `/admin`.

## Commands

| Command             | Does what                                            |
| -------------------- | ----------------------------------------------------- |
| `pnpm dev`           | Start the dev server (Turbopack)                       |
| `pnpm build`          | Production build                                       |
| `pnpm typecheck`      | `tsc --noEmit`                                          |
| `pnpm lint`           | ESLint                                                  |
| `pnpm test`           | Unit tests; cross-tenant isolation tests auto-skip without a configured database (see below) |
| `pnpm db:generate`    | Generate a new Drizzle migration from schema changes    |
| `pnpm db:migrate`     | Apply pending migrations to `DATABASE_URL`              |

## Cross-tenant isolation tests

`src/test/integration/tenant-isolation.test.ts` exercises real Postgres RLS
against a live Supabase project — no mocking (see CLAUDE.md rule #17). It
creates two organizations and two users and asserts, letter labels matching
CLAUDE.md §7's mandatory cases:

- an RLS-scoped query only ever returns the caller's own org/memberships
- **(C)/(D)** cross-tenant update and delete are both rejected
- **(E)** inserting a tenant-owned row while in another org's context is rejected
- **(F)** suspending a company blocks its own members' RLS-scoped reads
- **(G)/(I)** an RLS context bound to an unrecognized user id returns nothing, not an error
- **(H)** the service-role bypass is explicit and demonstrated side-by-side with the RLS-scoped path
- **(J)** concurrent `withRlsContext` calls never see each other's claims
- the one-active-org-per-user constraint rejects a second active membership
- granting/revoking a `platform_admins` row takes effect immediately

**To run it:**
1. Use a disposable/staging Supabase project, not production.
2. Set `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` in `.env.local` (or
   as real env vars — `pnpm test` reads `process.env` directly, `.env.local`
   works because Next's env loading also applies to the `next` CLI context
   vitest shares).
3. Apply migrations (`pnpm db:migrate`) against that project first.
4. `pnpm test`. Without the vars above, this suite skips (reported as
   `skipped`, not `passed`) rather than failing — a skip is a signal isolation
   hasn't been verified in that environment, not proof it works.

On **Node.js 20**, also set `NODE_OPTIONS=--experimental-websocket` when
running `pnpm test` locally — `@supabase/supabase-js`'s realtime client
requires a global `WebSocket`, which Node 20 doesn't provide without that
flag (Node 22+ doesn't need it; the CI workflow uses Node 22 for this
reason). This has nothing to do with RLS itself.

In CI (`.github/workflows/ci.yml`), this suite only runs for real if you add
`TEST_DATABASE_URL`, `TEST_SUPABASE_SERVICE_ROLE_KEY`, `TEST_SUPABASE_URL`,
`TEST_SUPABASE_ANON_KEY` as repository secrets pointing at a disposable
project; otherwise it skips there too.

## Manually verifying the first-owner invitation flow

Verified end-to-end against a real Supabase project (2026-07-11): admin
creates company → invites owner → owner's `/auth/confirm` establishes a
session → `/auth/set-password` → lands in `/app` seeing only that company.
`src/app/auth/confirm` is a client-rendered page for a reason found during
that verification: Supabase's invite links for this project deliver the
session as an implicit-flow `#access_token=...` hash fragment, which a
server-only Route Handler can never see (hash fragments never reach the
server) — see CLAUDE.md §3.11.

1. As your platform admin, go to `/admin/companies`, create a company, open
   it, and use "Create the first owner" on the Users tab.
2. Check the invited email's inbox (Supabase's built-in email sending works
   out of the box on free-tier projects, but at a **very low rate limit** —
   a handful of sends per hour before you get "email rate limit exceeded";
   configure custom SMTP in Supabase for anything beyond light testing).
3. Click the invite link. It should land you on `/auth/confirm` (briefly
   showing "Confirming your invite..."), then redirect to
   `/auth/set-password`.
4. Set a password. You should land on `/app` and see only that company's
   dashboard.
5. Confirm in `/admin/companies/<id>/users` that the membership shows
   `role: owner`, `status: active`.
6. Confirm an audit log entry exists for `company.owner_invited` (at invite
   time) and `user.invitation_accepted` (at accept time) —
   `/admin/companies/<id>/audit-logs`.

To manually verify suspended-company enforcement: suspend that company from
`/admin/companies/<id>` (Overview tab), then sign in as the owner — you
should land back on `/login` with "Your company's account has been
suspended..." rather than any company data, even briefly.

## What's implemented in this phase

- Platform Admin (`/admin`): companies (create/edit/activate/suspend),
  company users, creating the first company owner (email invite via Supabase
  Auth), platform-wide users and audit log views, overview stats.
- Company Dashboard (`/app`): authenticated, org-scoped shell with the full
  Phase 1 navigation; only the Dashboard page has real content so far — Leads,
  Conversations, Knowledge Base, AI Behaviour, Widget, Team, and Settings are
  placeholders reserving their routes for upcoming phases.
- First-owner invite acceptance (`/auth/confirm`, `/auth/set-password`):
  exchanges the Supabase invite token for a session and lets the new owner
  set a password.
- Centralized permissions (`src/modules/permissions`), tenant isolation via
  both application-layer scoping and Postgres RLS (including a suspended-org
  check at the RLS layer, not just the app layer), audit logging.
- The embedded widget and its public-key resolution endpoint are not built
  yet — that's the next phase.

## Known dependency pin

`zod` is pinned to `~4.0.17` — see the note in CLAUDE.md §9 before bumping it
or `@hookform/resolvers`.
