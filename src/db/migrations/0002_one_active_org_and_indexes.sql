-- Phase 1 rule: a company user belongs to exactly one active organization
-- (see CLAUDE.md §3). This partial unique index enforces it at the database
-- layer — application code (createFirstOwner, and any future invite/accept
-- path) must not rely solely on an app-layer check. It also happens to be
-- the ideal index for the hot-path lookup every RLS policy and
-- getCompanySession() perform: "memberships WHERE user_id = ? AND
-- status = 'active'" — a partial index scoped to that exact predicate.
create unique index "memberships_one_active_org_per_user"
on "memberships" ("user_id")
where "status" = 'active';

-- audit_logs has two real query shapes in modules/audit/service.ts:
-- listAuditLogs() (global, ordered by created_at, no filter) and
-- listAuditLogs({ organizationId }) (per-company). Neither is served by an
-- existing index.
create index "audit_logs_created_at_idx" on "audit_logs" ("created_at" desc);
create index "audit_logs_org_id_created_at_idx" on "audit_logs" ("organization_id", "created_at" desc);
