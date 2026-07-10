# AI Lead Agent — Architecture & Security Rules

This file is the permanent source of truth for how this codebase is built. It is
read by Claude Code (and any human contributor) before making changes. Rules in
this file override convenience, speed, or "just this once" exceptions.

Product name is a working title. Product vision, phase scope, and full spec
history live in the original planning conversation — this file captures only
the rules that must survive across sessions.

## 1. Product shape (Phase 1 only)

Three separate application surfaces in one Next.js codebase:

- **Platform Admin** (`/admin`) — used only by the SaaS owner. Manages companies,
  company users, sees cross-tenant usage/audit data.
- **Company Dashboard** (`/app`) — one isolated workspace per company
  (organization). Leads, conversations, knowledge base, AI behaviour, widget,
  team, settings.
- **Embedded Widget** (`/widget`, `/api/widget/*`) — public-facing chat widget
  embedded on customer websites, authenticated only by a public widget key.

Do not build beyond Phase 1 scope (no WhatsApp, no voice calls, no billing, no
appointment booking, no lead hand-off automation) — but do not paint the schema
into a corner either. See §8.

## 2. Non-negotiable architecture rules

- **Modular monolith.** One Next.js (App Router) TypeScript codebase. No
  microservices, no Kubernetes, no Kafka, no event sourcing.
- **No Redis, no BullMQ in Phase 1.** Async work (document processing) goes
  through a job-provider abstraction (`providers/jobs`), not a hand-rolled
  queue.
- **Provider abstractions only where Phase 1 code actually needs them:** AI
  (`providers/ai`), embeddings (`providers/embeddings`), storage
  (`providers/storage`), jobs (`providers/jobs`). Business modules never import
  a vendor SDK directly. Do not create abstractions for things Phase 1 doesn't
  use yet (no WhatsApp/voice provider interfaces now).
- **Centralized permissions.** No `if (role === "admin")` scattered in code.
  All authorization goes through `modules/permissions` (`can(session, permission)`).
  Roles map to permissions in one place.
- Keep modules practical: `schema / types / validation / repository / service /
  permissions` per module — but don't create empty placeholder files for a
  module that doesn't need them yet.

## 3. Multi-tenancy — the most important rule in this file

**Every tenant-owned table has a NOT NULL `organization_id` column, and every
tenant table has Postgres RLS enabled. Both layers are mandatory — neither one
alone is sufficient.**

1. **Never trust `organization_id` (or any tenant identifier) from the client**
   — not from the URL, not from a request body, not from frontend state, not
   from a JWT claim the client could influence. It is resolved server-side,
   every time, from the authenticated user's verified `memberships` row.
2. Every repository function that reads/writes tenant data takes an
   `organizationId` that was resolved server-side and never a value passed
   straight through from a request.
3. Every tenant table ships with an RLS policy in the same migration that
   creates the table. No table goes live without RLS. Default posture is
   **deny** — no policy means no access, not open access.
4. Standard RLS pattern:
   ```sql
   USING (organization_id IN (
     SELECT organization_id FROM memberships
     WHERE user_id = auth.uid() AND status = 'active'
   ))
   ```
   applied to SELECT/UPDATE/DELETE, with matching `WITH CHECK` for INSERT.
5. Normal application queries (admin dashboard, company dashboard) run through
   a Postgres role that respects RLS (the user's own session/JWT via Supabase),
   **not** the service-role key.
6. The **service-role key is a server-only secret**, used in four narrow,
   explicit contexts, each of which must manually re-implement scoping since
   RLS is bypassed:
   - Platform Admin routes (inherently cross-tenant; gated by a separate
     `platform_admins` table check, not by org membership).
   - Background job workers (processing documents, etc.).
   - Public widget endpoints (no user session exists — see §4).
   - The suspended-organization notice check (`lib/auth/suspended.ts`): RLS
     makes a suspended org's rows invisible even to its own members'
     RLS-scoped queries (correct for data access), which means
     `getCompanySession()` can't tell "suspended" apart from "no membership
     at all." This check exists solely to pick the right login-page message —
     it returns a boolean only and is never used to return or grant access to
     tenant data.
   The service-role key must never be imported into any file that can end up
   in a client bundle, and must never be logged.
7. Platform Admin access is structurally separate from company access — a
   platform admin is not a member of any organization; membership in
   `platform_admins` is checked independently, and `/admin` routes must reject
   any request without it (including requests from a valid company user).
8. A suspended company (`organizations.status = 'suspended'`) must lose access
   at both layers: application-layer checks reject the request, and (where
   practical) RLS policies account for org status too — don't rely on the
   application check alone.
9. **Cross-tenant isolation tests are mandatory** for every module that reads
   or writes tenant data (see §7).
10. **One active organization per user in Phase 1.** A company user belongs
    to exactly one organization at a time — enforced by a partial unique
    index (`memberships_one_active_org_per_user`, on `user_id` where
    `status = 'active'`), not just an application-layer check. There is no
    organization-switcher UI and none should be built without first revisiting
    this rule explicitly. `getCompanySession()` relies on this: it resolves
    "the" active membership with no ordering guarantee across multiple rows,
    which is only safe because the database guarantees there's at most one.
11. **Invitations: Supabase Auth owns the token, not us.** The only way a
    company user is provisioned in Phase 1 is a platform-admin-triggered
    invite (`supabase.auth.admin.inviteUserByEmail`, see
    `modules/organizations/service.ts`'s `createFirstOwner`). We never
    generate, store, or validate the invite token ourselves — expiry,
    single-use consumption, and email/identity binding are entirely
    Supabase's responsibility. `src/app/auth/confirm/route.ts` only asks
    Supabase "is this token valid" via `verifyOtp` and redirects; it holds no
    token state. The membership row is created at invite time (by the admin
    action), not at acceptance time (by the user) — acceptance
    (`src/app/auth/set-password`) only establishes a session and sets a
    password, so re-visiting or retrying that step can't create a duplicate
    membership.

## 4. Public widget rules

- The embed snippet exposes **only** a public widget key. It must never
  contain an organization ID, database ID, Supabase service key, AI provider
  key, or any other secret.
- Backend resolution chain for every widget request: `public widget key →
  widgets row → organization → ai_configuration + knowledge base → allowed
  actions`. This resolution happens server-side on every request; the key is
  the only thing the client can supply.
- Widget endpoints use the service-role client (no visitor session exists) but
  must manually scope every query to the resolved `organization_id`/`widget_id`
  and return only public-safe fields. Treat every widget endpoint as
  internet-facing and untrusted input.
- Invalid or inactive widget keys are rejected with a generic error — never
  leak whether a key format is "close" to valid, and never leak which
  organization a key would have resolved to.
- Public widget endpoints get rate limiting.

## 5. AI behaviour & knowledge rules

- Company-configurable AI behaviour is **structured configuration**, never a
  raw system-prompt textarea exposed to customers.
- The final system prompt sent to the AI provider is assembled server-side
  from: (a) platform-level mandatory safety/security instructions, and (b)
  the company's structured configuration. **Platform-level instructions are
  always applied last / with highest precedence and can never be overridden
  by company configuration.**
- The AI answers only from the requesting organization's knowledge base.
  Knowledge retrieval (pgvector similarity search) is always filtered by
  `organization_id` at the query level — never filtered only in application
  code after a broader fetch.
- If retrieval doesn't produce a confident match, the AI must say it doesn't
  have enough information and offer human hand-off — it must never invent
  prices, offers, policies, availability, or business promises. This is a
  platform-level guardrail, not something a company can disable.
- Store only operational data needed by the product (messages, knowledge
  references used, i.e. which chunk IDs informed a reply). Never store or
  expose raw model chain-of-thought/reasoning.

## 6. Security baseline

- Input validation with Zod at every API boundary (route handlers, server
  actions). Validate, then trust — don't re-validate ad hoc downstream.
- File uploads (knowledge PDFs, logos, avatars): enforce MIME type allowlist
  and size limits server-side before anything touches storage or a job queue.
- Environment variables are validated at startup (Zod schema in `lib/env.ts`)
  — fail fast on a missing/malformed var rather than failing deep in a request.
- Never log secrets, tokens, passwords, or full API keys. Audit log metadata
  must be reviewed for safety before being written (no secrets, no full
  request bodies).
- No secrets in client bundles, ever. If a value needs to reach the browser it
  must be an explicitly public value (`NEXT_PUBLIC_*`), never a service key,
  never a provider API key.
- No sensitive data in URLs (query strings get logged by proxies/analytics).
- Audit logs are append-only from normal application flow: no UPDATE/DELETE
  RLS policy is granted on `audit_logs` for the `authenticated` role; inserts
  happen via server-side code or a `SECURITY DEFINER` function.
- Rate limit public/unauthenticated endpoints (widget chat, auth).
- Webhook endpoints (future) verify signatures before processing.

## 7. Testing requirements (minimum bar, every PR that touches tenant data)

- Company A cannot read/write Company B data via any tenant-scoped
  endpoint (API, server action, or direct query).
- Company users cannot access `/admin` or any platform-admin API.
- Suspended company users are blocked from `/app` and its APIs.
- Viewer role cannot perform any write action.
- Agent role cannot access leads/conversations not assigned to them (where
  the product restricts this).
- Invalid/foreign widget keys are rejected; a valid widget key never returns
  another organization's data.
- Knowledge semantic search results never cross organization boundaries.
- File upload rejects disallowed MIME types and oversized files.
- AI behaviour configuration changes for one org never affect another org's
  assembled prompt.

## 8. Designing for the future without building it now

The schema should not block later phases (WhatsApp, voice, appointments,
billing, human hand-off), but none of those get implemented in Phase 1:

- `knowledge_collections` exists as a real table even though Phase 1 only
  ever creates one default collection per organization — don't hardcode a
  1:1 org:knowledge assumption elsewhere.
- Lead/conversation schema carries a `source` field so future channels
  (WhatsApp, phone) can slot in without a redesign — but no channel other
  than the website widget is implemented now.
- Provider interfaces (`providers/ai`, `providers/jobs`, `providers/storage`)
  are the seam future providers (voice, WhatsApp) would plug into — but don't
  create empty interfaces for providers nothing calls yet.

## 9. Next.js 16 specifics (this repo uses 16.x, not 15.x)

This project was scaffolded on Next.js 16, which has real breaking changes from
older Next.js knowledge. Rules that matter here:

- **No `middleware.ts`.** The file is `src/proxy.ts`, exporting a `proxy`
  function (not `middleware`). It still runs before every matched request and
  is still the first gate for `/admin` and `/app`, but per Next's own docs it
  "should be used as a last resort" for auth — **it is a first gate, not the
  only gate.** Every Server Action and Route Handler re-verifies auth and org
  scope itself (see Data Access Layer rule below). Never reason "proxy already
  checked this."
- **`cookies()`, `headers()`, `params`, `searchParams` are all async** — always
  `await` them. There is no synchronous fallback in v16.
- **Data Access Layer pattern (Next's own recommendation, adopted here):**
  database/service-role/API-key access lives only in `modules/*/service.ts`
  and `db/queries`, marked with `import 'server-only'` at the top. Server
  Components and Server Actions call into this layer; they never hold a
  Supabase/Drizzle client or a secret directly. This is the same seam that
  already keeps `organization_id` resolution server-side (§3) — the DAL is
  where that resolution happens.
- **Every Server Action re-verifies auth and authorization itself**, even for
  actions only reachable from an already-guarded page. Server Actions are
  POST-reachable independent of the page/proxy that renders their form, and
  Next explicitly warns a page-level check does not extend to actions defined
  within it.
- **Server Action return values are minimal DTOs** — return only what the UI
  needs, never a raw Drizzle row, matching §6's "no sensitive data leakage"
  rule.
- `next lint` is removed in v16; lint runs via the ESLint CLI directly
  (`pnpm lint` → `eslint`).
- Turbopack is the default for `next dev`/`next build`.

**Known dependency pin:** `zod` is pinned to `~4.0.17` (patch-only updates).
`@hookform/resolvers@5.4.0`'s zod adapter type-checks a literal
`_zod.version.minor` against `0`; zod 4.1.x+ breaks that check with a real
TypeScript error (not a runtime issue, but `tsc --noEmit` fails). Before
bumping either package, reproduce with `pnpm typecheck` first — if this was
fixed upstream, widen the zod range back to `^4`.

## 10. Working agreement for Claude Code in this repo

- Inspect before writing — read existing schema/config before changing it.
- Work in small, reviewable phases. After each phase: typecheck, lint, test,
  state the security implications, and list changed files.
- No unrelated changes bundled into a phase.
- No silent architecture changes — if a rule in this file needs to change,
  say so explicitly and get confirmation before proceeding.
- Don't add a dependency without stating why it's needed and what it
  replaces/enables; prefer an existing dependency if it's suitable.
- Never weaken TypeScript strictness to make an error go away. `any` requires
  a documented reason inline.
- Never bypass auth or RLS "temporarily" or "for now." Never leave a
  placeholder/mock security check. Never fake a production integration.
- If a security decision is ambiguous, stop and present the options instead
  of picking one silently.
