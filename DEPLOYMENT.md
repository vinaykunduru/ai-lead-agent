# Deployment

Quick reference for deploying AI Lead Agent / Bloom. Full detail: [`docs/deployment/README.md`](./docs/deployment/README.md).

## Stack

Vercel (Next.js hosting) + Supabase (Postgres/Auth/Storage) + Inngest (background jobs) + Sentry (errors, optional). Production: `https://agent.bloomdigital.co.in`.

## First-time setup

1. Create the Supabase project, apply migrations (`pnpm db:migrate`), allowlist the `/auth/confirm` redirect URL, create the first `platform_admins` row — see [Getting Started](./docs/getting-started/README.md#local-setup) (same steps as local, against the production project).
2. Set every server + public env var from [Getting Started → Environment variables](./docs/getting-started/README.md#environment-variables) in the Vercel project settings.
3. Set `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` (required in production, unlike local dev).
4. Connect the Vercel project to this repo's `main` branch — Vercel deploys automatically on push.

## Every deploy

Run the [production checklist](./docs/deployment/README.md#production-checklist):

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Apply any new migrations to production (`pnpm db:migrate` with production `DATABASE_URL`) **before** the code that depends on them goes live.

## Known production constraint

`DATABASE_URL` must be the Supabase **Session pooler** connection string — the direct-connection hostname has no IPv4 DNS record. The Postgres client is capped at `max: 1` connection per instance (`src/db/client.ts`) to avoid exhausting the Supabase pooler under concurrent Vercel invocations — see [Deployment → Vercel](./docs/deployment/README.md#vercel) for the incident this fixed.

## Rollback

Vercel keeps prior deployments — promote a previous deployment from the Vercel dashboard if a release needs to be reverted. There is no down-migration tooling for the database (see [Database → Migrations](./docs/database/migrations.md)); a schema rollback requires a new forward migration, not a revert.
