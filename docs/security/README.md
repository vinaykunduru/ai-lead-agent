# Security

This page summarizes the security model already defined normatively in [`CLAUDE.md`](../../CLAUDE.md); see that file for the authoritative rules. For a security researcher reporting a vulnerability, see [`SECURITY.md`](../../SECURITY.md).

- [Tenant isolation](#tenant-isolation)
- [Authentication & session model](#authentication--session-model)
- [Secrets](#secrets)
- [Input validation](#input-validation)
- [Public widget surface](#public-widget-surface)
- [Audit logs](#audit-logs)
- [Best practices for contributors](#best-practices-for-contributors)

## Tenant isolation

Two independent, mandatory layers — see [Database → Row-Level Security](../database/rls.md) and [Authorization](../authorization/README.md):

1. **Application layer**: `organization_id` is resolved server-side from the authenticated user's `memberships` row, never trusted from the client (URL, body, frontend state, or a JWT claim the client could influence).
2. **Database layer**: every tenant table has RLS enabled, default-deny, enforced via the `active_organization_ids()` helper.

Neither layer alone is sufficient — this is the single most important rule in the codebase (`CLAUDE.md` §3).

## Authentication & session model

Supabase Auth end to end — no custom password storage, no custom token generation. See [Authentication](../authentication/README.md). Platform Admin access is structurally separate from company membership (`platform_admins` table, service-role-checked) — a company user, however privileged, is never automatically a platform admin.

## Secrets

- The **service-role key** is a server-only secret used in exactly four documented contexts (Platform Admin routes, background jobs, public widget endpoints, the suspended-org boolean check) — see [`CLAUDE.md`](../../CLAUDE.md) §3.6. It must never be imported into a file that can end up in a client bundle, and never logged.
- AI provider keys, the Voyage embeddings key, and Inngest signing keys are server-only, validated at startup via Zod (`src/lib/env.server.ts`) — the app fails fast on a missing/malformed var.
- Only `NEXT_PUBLIC_*`-prefixed values are ever intended for the browser bundle.

## Input validation

Every API boundary (Route Handlers, Server Actions) validates with Zod before touching a service function — see [API Reference](../api/README.md#conventions). File uploads (knowledge PDFs/DOCX) enforce a MIME allowlist and size limit server-side before anything touches storage or the job queue (`src/modules/knowledge/validation.ts`).

## Public widget surface

Treated as internet-facing and untrusted on every request. Three independent gates (public key resolution, domain allowlist, rate limiting) — see [Widget → Security model](../widget/README.md#security-model). Invalid/inactive keys and malformed requests are rejected with one generic error, never leaking which check failed or which organization a "close" key would have resolved to.

## Audit logs

`audit_logs` is append-only by construction, not just convention: no `UPDATE`/`DELETE` RLS policy exists for the `authenticated` role at all (see [Database → RLS](../database/rls.md#policy-matrix-by-table-group)) — only `service_role` could bypass this, and no code path does. Every write goes through a single function, `recordAuditLog()` (`src/modules/audit/service.ts`), which is the only place in the codebase that inserts into this table.

**What's logged**: `actorUserId`, `actorType` (`platform_admin` | `company_user` | `system`), `action` (e.g. `company.owner_invited`), `resourceType`/`resourceId`, and a `metadata` JSON object — reviewed for safety before being written (`CLAUDE.md` §6): note content, reply content, and any secret are deliberately excluded, replaced with just the resource id (e.g. a note's audit entry stores `noteId`, never the note text).

**Reading audit logs**:
- Platform-admin: `listAuditLogs()` — cross-tenant by design, service-role, gated by `requirePlatformAdmin()`. Screens: `/admin/audit-logs` (platform-wide), `/admin/companies/[companyId]/audit-logs` (per-company).
- Company-side: an RLS-scoped read path exists for a company's own audit history (e.g. shown against a specific Knowledge Base document) — added in migration `0006` specifically to grant company users read access to their own org's entries, still without any write policy.

## Best practices for contributors

- Never bypass auth or RLS "temporarily." Never leave a placeholder/mock security check.
- Never weaken TypeScript strictness to silence an error; `any` requires a documented reason inline.
- If a security decision is ambiguous, stop and present the options rather than picking one silently (`CLAUDE.md` §10).
- Any new tenant table ships RLS in the same migration that creates it (see [Database — RLS](../database/rls.md#what-every-new-tenant-table-must-ship-with)).
- Any new tenant-data module needs its own [cross-tenant isolation test](../testing/README.md#cross-tenant-isolation-tests).

Related: [`CLAUDE.md`](../../CLAUDE.md) · [`SECURITY.md`](../../SECURITY.md) · [Authorization](../authorization/README.md) · [Database — RLS](../database/rls.md)
