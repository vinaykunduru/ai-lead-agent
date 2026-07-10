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
   - `DATABASE_URL` — Project Settings → Database → Connection string (the
     "Session pooler" URI works well for this app)
   - `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for local dev
   - AI/embeddings/job provider keys are optional until the Knowledge Base
     and AI Behaviour modules are built (later phase) — leave them blank for
     now.
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Apply the database migrations (creates tables and enables RLS — see
   `src/db/migrations`):
   ```bash
   pnpm db:migrate
   ```
5. **Create your first platform admin manually.** There's no UI for this by
   design (platform admin is not a self-serve role): in the Supabase SQL
   editor, after signing up or creating a user in Authentication → Users, run:
   ```sql
   insert into platform_admins (user_id) values ('<the user''s auth.users id>');
   ```
6. Run the dev server:
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
against a live Supabase project — creating two organizations, two users, and
asserting one can never read the other's data (including a direct query for
the other org's id, and a suspended-company check). It requires
`DATABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + the `NEXT_PUBLIC_*` Supabase
vars to be set; otherwise it skips cleanly rather than failing or mocking the
database (see CLAUDE.md rule #17). Run it against a disposable/staging
project, not production.

## What's implemented in this phase

- Platform Admin (`/admin`): companies (create/edit/activate/suspend),
  company users, creating the first company owner (email invite via Supabase
  Auth), platform-wide users and audit log views, overview stats.
- Company Dashboard (`/app`): authenticated, org-scoped shell with the full
  Phase 1 navigation; only the Dashboard page has real content so far — Leads,
  Conversations, Knowledge Base, AI Behaviour, Widget, Team, and Settings are
  placeholders reserving their routes for upcoming phases.
- Centralized permissions (`src/modules/permissions`), tenant isolation via
  both application-layer scoping and Postgres RLS, audit logging.
- The embedded widget and its public-key resolution endpoint are not built
  yet — that's the next phase.

## Known dependency pin

`zod` is pinned to `~4.0.17` — see the note in CLAUDE.md §9 before bumping it
or `@hookform/resolvers`.
