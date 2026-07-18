# Getting Started

## Product vision

AI Lead Agent (branded **Bloom**/**BloomAI** in production) is a multi-tenant SaaS platform that lets companies embed an AI chat widget on their website to capture, qualify, and convert visitors into leads — grounded entirely in each company's own knowledge base, with a human-takeover path when the AI can't help. See [`CLAUDE.md`](../../CLAUDE.md) §1 for the exact Phase 1 product boundary.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, React 19) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4, shadcn/ui, Base UI |
| Database | PostgreSQL via Supabase, pgvector extension |
| ORM | Drizzle ORM |
| Auth | Supabase Auth |
| Validation | Zod (pinned `~4.0.17` — see [note below](#known-dependency-pin)) |
| AI providers | Claude, OpenAI, Gemini, Llama-compatible (raw `fetch`, no vendor SDKs) |
| Embeddings | Voyage AI (`voyage-3`, 1024 dims) |
| Background jobs | Inngest |
| Error tracking | Sentry |
| Package manager | pnpm |

Full architecture rules live in [`CLAUDE.md`](../../CLAUDE.md) — read it before making changes; it overrides convenience or "just this once" exceptions.

## Local setup

1. **Create a Supabase project** (free tier is fine to start): https://supabase.com/dashboard
2. Copy `.env.example` to `.env.local` and fill in the required values — see [Environment variables](#environment-variables) below.
3. **Allow the invite-confirmation redirect.** Supabase dashboard → Authentication → URL Configuration → Redirect URLs, add `http://localhost:3000/auth/confirm` (and your production `https://<domain>/auth/confirm` once deployed). Supabase rejects `redirectTo` URLs not on this allowlist — without this, the first-owner invite email link fails silently.
4. Install dependencies:
   ```bash
   pnpm install
   ```
5. Apply database migrations (creates all tables, enables RLS, adds the one-active-org-per-user constraint):
   ```bash
   pnpm db:migrate
   ```
6. **Create your first platform admin manually.** There is no self-serve UI for this by design — platform admin is not a role anyone can grant themselves. After signing up or creating a user in Supabase Authentication → Users, run in the Supabase SQL editor:
   ```sql
   insert into platform_admins (user_id) values ('<the user''s auth.users id>');
   ```
7. Run the dev server:
   ```bash
   pnpm dev
   ```
   Visit `http://localhost:3000`, sign in as your platform admin, and you'll land on `/admin`.

## Environment variables

Validated at startup via Zod (`src/lib/env.server.ts`, `src/lib/env.public.ts`) — the app fails fast on a missing/malformed var rather than failing deep in a request, per [`CLAUDE.md`](../../CLAUDE.md) §6.

### Public (`NEXT_PUBLIC_*`, safe for the browser bundle)

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Project Settings → API |
| `NEXT_PUBLIC_APP_URL` | ✅ | `http://localhost:3000` for local dev |
| `NEXT_PUBLIC_SENTRY_DSN` | — | optional |

### Server-only (never bundled to the client)

| Variable | Required | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Project Settings → API. Server-only secret — see [`CLAUDE.md`](../../CLAUDE.md) §3.6 for the four narrow contexts it's allowed in |
| `DATABASE_URL` | ✅ | See [Session pooler vs. direct connection](#session-pooler-vs-direct-connection) below |
| `ANTHROPIC_API_KEY` | — | needed only if a company selects the Claude AI provider |
| `VOYAGE_API_KEY` | — | needed for Knowledge Base document processing (embeddings) |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | — | optional pair; needed if a company selects the OpenAI provider |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | — | optional pair |
| `LLAMA_API_KEY` / `LLAMA_API_BASE_URL` / `LLAMA_MODEL` | — | optional trio — "Llama" means any OpenAI-compatible host (Groq, Together, self-hosted vLLM/Ollama) |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | — | optional locally (Inngest dev server works without them); required in production |
| `SENTRY_AUTH_TOKEN` | — | optional, for source-map upload at build time |

### Session pooler vs. direct connection

Use the **"Session pooler"** connection string (Project Settings → Database), not "Direct connection". The direct-connection hostname (`db.<ref>.supabase.co`) only has an IPv6 (AAAA) DNS record — no IPv4 record exists for it at all — so it fails to resolve on any IPv4-only network (many sandboxes, containers, and corporate networks included) with a plain DNS error unrelated to credentials. The pooler hostname (`aws-0-<region>.pooler.supabase.com`) is IPv4-reachable.

Separately: the connection role must be able to `SET ROLE authenticated` — Supabase's default `postgres` role can; a custom restricted role needs that grant explicitly (see `src/db/client.ts`'s `withRlsContext`, and [Database — RLS](../database/rls.md#which-postgres-role-runs-which-query)).

## Commands

| Command | Does what |
|---|---|
| `pnpm dev` | Start the dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Serve a production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint CLI (`next lint` was removed in Next.js 16) |
| `pnpm test` | Unit + integration tests — [cross-tenant isolation tests](../testing/README.md#cross-tenant-isolation-tests) auto-skip without a configured database |
| `pnpm db:generate` | Generate a new Drizzle migration from schema changes |
| `pnpm db:migrate` | Apply pending migrations to `DATABASE_URL` |

## Known dependency pin

`zod` is pinned to `~4.0.17` (patch-only). `@hookform/resolvers@5.4.0`'s zod adapter type-checks a literal `_zod.version.minor` against `0`; zod `4.1.x+` breaks that check with a real TypeScript error (not a runtime issue — `tsc --noEmit` fails). Before bumping either package, reproduce with `pnpm typecheck` first; if this was fixed upstream, widen the range back to `^4`.

## Next steps

- [Architecture overview](../architecture/README.md) — how the pieces fit together, with diagrams
- [Database](../database/README.md) — schema, RLS, migrations
- [Testing](../testing/README.md) — including how to run the cross-tenant isolation suite against a real Supabase project
- [Deployment](../deployment/README.md) — Vercel + Supabase + Inngest in production
