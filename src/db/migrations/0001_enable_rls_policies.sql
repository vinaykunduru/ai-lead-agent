-- Row Level Security policies.
--
-- This is the database-layer half of tenant isolation described in
-- CLAUDE.md §3. It must hold even if application code has a bug: every
-- tenant table defaults to deny, and only rows the requesting user's
-- verified, active membership entitles them to are visible or writable.
--
-- These policies apply to the Postgres "authenticated" role, which our app
-- assumes only inside src/db/client.ts's withRlsContext() transaction
-- wrapper (SET LOCAL ROLE authenticated + auth.uid() bound to the verified
-- session user). Ordinary application queries always go through that path.
--
-- The "service_role" Postgres role (used directly by src/db/client.ts's `db`
-- export) has BYPASSRLS and is not subject to any of this — its use is
-- restricted by convention to the platform-admin module, job workers, public
-- widget endpoints, and the suspended-org notice check, each of which must
-- manually scope every query (see CLAUDE.md §3.6). RLS cannot protect
-- against a bug in code that deliberately opts out of RLS, which is exactly
-- why service-role usage is kept to those four narrow, reviewed call sites.

-- organizations: a company user may read organizations they belong to.
-- Creating, editing, activating, and suspending companies are platform-admin
-- actions performed via the service-role client, not by "authenticated"
-- users — so there is intentionally no insert/update/delete policy here.
alter table "organizations" enable row level security;

-- Suspended companies lose access at this layer too, not just the app-layer
-- check in getCompanySession() — see CLAUDE.md §3.8.
create policy "organizations_select_own_memberships"
on "organizations"
for select
to authenticated
using (
  status <> 'suspended'
  and id in (
    select organization_id from "memberships"
    where user_id = auth.uid() and status = 'active'
  )
);

-- memberships: a company user may see the membership roster of any
-- organization they are an active member of (needed for the future Team
-- page). Inviting, role changes, and removal are not yet implemented in
-- Phase 1 — no insert/update/delete policy for "authenticated" yet.
alter table "memberships" enable row level security;

create policy "memberships_select_same_org"
on "memberships"
for select
to authenticated
using (
  organization_id in (
    select m.organization_id from "memberships" m
    join "organizations" o on o.id = m.organization_id
    where m.user_id = auth.uid() and m.status = 'active' and o.status <> 'suspended'
  )
);

-- platform_admins: never readable or writable by ordinary company users.
-- No policy is granted to "authenticated" or "anon" — RLS defaults to deny.
-- Only service-role code in the platform-admin module touches this table.
alter table "platform_admins" enable row level security;

-- audit_logs: append-only, and only via service-role server code (see
-- CLAUDE.md §6). No policy is granted to "authenticated" or "anon" for any
-- operation, including select — company/admin UIs that need to display
-- audit history read through a server-side service function, not directly.
alter table "audit_logs" enable row level security;
