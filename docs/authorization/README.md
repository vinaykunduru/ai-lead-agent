# Authorization

Centralized permissions — no `if (role === "admin")` scattered through the codebase (`CLAUDE.md` §2). Every authorization decision reduces to one call: `can(session, permission)` / `assertPermission(session, permission)`.

## The permission model

`src/modules/permissions/`:

- **`constants.ts`** — the full, flat list of 28 permission strings the app understands (`"leads.view"`, `"analytics.export"`, etc.). This is the single source of truth for what a permission string *can* be — nothing checks a role name directly anywhere else in the codebase.
- **`roles.ts`** — `ROLE_PERMISSIONS: Record<Role, Permission[]>`, mapping each of the 5 company roles to its permission set. This is the *only* place role → permission mapping is defined.
- **`can.ts`**:
  ```ts
  export function hasPermission(role: Role, permission: Permission): boolean;
  export function can(subject: { role: Role }, permission: Permission): boolean;
  export function assertPermission(subject: { role: Role }, permission: Permission): void; // throws "Forbidden: missing permission "<perm>""
  ```

Service functions call `assertPermission(session, "...")` as their first line — see [`src/lib/auth/can.ts` usage across `modules/*/service.ts`](../backend/README.md). The thrown `Forbidden: ...` message is what [`apiError()`](../api/README.md#error-mapping) maps to HTTP 403.

## Roles and permissions

| Permission | owner | admin | manager | agent | viewer |
|---|:---:|:---:|:---:|:---:|:---:|
| `company.view` | ✅ | ✅ | ✅ | — | ✅ |
| `company.manage` | ✅ | — | — | — | — |
| `users.view` | ✅ | ✅ | ✅ | — | ✅ |
| `users.manage` | ✅ | ✅ | — | — | — |
| `leads.view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `leads.create` | ✅ | ✅ | ✅ | — | — |
| `leads.update` | ✅ | ✅ | ✅ | ✅ | — |
| `leads.delete` | ✅ | ✅ | — | — | — |
| `leads.assign` | ✅ | ✅ | ✅ | — | — |
| `conversations.view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `inbox.view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `inbox.reply` | ✅ | ✅ | ✅ | ✅ | — |
| `knowledge.view` | ✅ | ✅ | — | — | ✅ |
| `knowledge.create` | ✅ | ✅ | — | — | — |
| `knowledge.update` | ✅ | ✅ | — | — | — |
| `knowledge.delete` | ✅ | ✅ | — | — | — |
| `knowledge.search` | ✅ | ✅ | — | — | ✅ |
| `knowledge.reprocess` | ✅ | ✅ | — | — | — |
| `ai.view` | ✅ | ✅ | — | — | ✅ |
| `ai.update` | ✅ | ✅ | — | — | — |
| `ai.test` | ✅ | ✅ | — | — | — |
| `widget.view` | ✅ | ✅ | — | — | ✅ |
| `widget.create` | ✅ | ✅ | — | — | — |
| `widget.update` | ✅ | ✅ | — | — | — |
| `widget.delete` | ✅ | ✅ | — | — | — |
| `widget.publish` | ✅ | ✅ | — | — | — |
| `analytics.view` | ✅ | ✅ | ✅ | — | ✅ |
| `analytics.export` | ✅ | ✅ | ✅ | — | — |

`owner` has every permission; `admin` has every permission except `company.manage` (deleting/transferring the organization itself). `agent` is deliberately narrow — leads/conversations/inbox only, and even within those, resource-level ownership is checked separately in the service layer (see [Agent-role restriction](#agent-role-restriction) below), not via a broader role permission.

## Users & Team

Company user management (`/app/team`) is gated by `users.view` (list) / `users.manage` (invite, change role, disable). A user is provisioned only via a platform-admin-triggered Supabase invite — see [Authentication → invitations](../authentication/README.md#invitations--supabase-owns-the-token-not-this-app).

## Agent-role restriction

Beyond the flat permission table, the `agent` role has a resource-level restriction enforced in the service layer (not expressible as a single permission string): an agent can only view/update leads and conversations that are **unassigned or assigned to them**. Requests for a lead/conversation an agent can't see return `404`, not `403` — this avoids confirming the resource exists to a party who shouldn't know about it. See [Leads](../api/leads.md#roles) and [Inbox](../inbox/README.md).

## Platform Admin — structurally separate

A platform admin is **not** a member of any organization. Access is gated by a dedicated `platform_admins` table check (`src/lib/auth/platform-admin.ts` → `isPlatformAdmin()` / `requirePlatformAdmin()`), checked via the **service-role client**, never `withRlsContext` — the `platform_admins` table has zero RLS policies for the `authenticated` role, so an RLS-scoped query would always return zero rows regardless of who's asking. This is one of the four documented service-role call sites in [`CLAUDE.md`](../../CLAUDE.md) §3.6.

`/admin` routes reject any request without a `platform_admins` row — including requests from an otherwise-valid company user. There is no role that is "both" a platform admin and a company member in a way that grants combined access; the two systems don't intersect.

## Enforcement layers

Three independent layers, all mandatory (`CLAUDE.md` §9):

1. **`src/proxy.ts`** — first gate only. Refreshes the Supabase session cookie and redirects obviously-unauthenticated requests away from `/admin`/`/app` for a clean UX. It does **not** check role, org membership, or suspended status — per Next.js's own guidance that a matcher change or refactor can silently remove proxy coverage, this file stays deliberately thin.
2. **Layouts** (`src/app/admin/layout.tsx`, `src/app/app/layout.tsx`) — call `requirePlatformAdmin()` / `requireCompanySession()` server-side on every render.
3. **Every Server Action and Route Handler** re-verifies auth and permission itself, even when only reachable from an already-guarded page — Next.js explicitly warns that a page-level check does not extend to the Server Actions defined within it. "Proxy already checked this" or "the page already checked this" is never a valid reason to skip a check in a service function.

## Suspended organizations

A suspended org (`organizations.status = 'suspended'`) loses access at both layers: `getCompanySession()` includes `organizationStatus` so application code can reject the request, and — because `active_organization_ids()` (the RLS helper, see [Database → RLS](../database/rls.md)) excludes suspended orgs — the org's data becomes invisible via RLS too, even to its own members. This dual failure mode is why a dedicated service-role check (`src/lib/auth/suspended.ts`) exists solely to distinguish "suspended" from "no membership at all" for the purpose of showing the right login-page message — it returns a boolean only and never grants data access.

## One active organization per user

Enforced at the database level (`memberships_one_active_org_per_user`, a partial unique index on `user_id` where `status = 'active'`), not just in application code — see [`CLAUDE.md`](../../CLAUDE.md) §3.10. `getCompanySession()` relies on this: it resolves "the" active membership with no explicit ordering, which is only safe because the database guarantees at most one row can match.

Related: [Authentication](../authentication/README.md) · [Database — RLS](../database/rls.md) · [API conventions](../api/README.md#conventions)
