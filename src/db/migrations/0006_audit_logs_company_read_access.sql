-- Knowledge Base's "Document Details > Audit History" is the first company
-- (non-platform-admin) UI that needs to read audit_logs. Until now,
-- audit_logs had no SELECT policy for "authenticated" at all — reads only
-- ever happened via the platform-admin service-role path
-- (modules/audit/service.ts's listAuditLogs). Rather than add a fifth
-- service-role exception for "a user reading their own org's data" — which
-- is exactly what RLS exists for — this grants ordinary RLS-scoped read
-- access, scoped the same way every other company-facing table is.
--
-- Still append-only: this is SELECT only, no INSERT/UPDATE/DELETE policy
-- for "authenticated" (see CLAUDE.md §6 — writes stay service-role-only via
-- recordAuditLog()).
--
-- Platform-level entries (organization_id IS NULL, e.g. "company.created")
-- remain invisible to company users: `null in (select ...)` evaluates to
-- NULL, not true, in SQL, so those rows never match this policy.
create policy "audit_logs_select_own_org"
on "audit_logs"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));
