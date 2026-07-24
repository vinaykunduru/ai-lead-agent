-- Row Level Security for visitor_profiles. Uses
-- public.active_organization_ids() (migration 0003), the same helper every
-- other tenant table's RLS policy uses.
--
-- The conversation pipeline (modules/visitor-profiles/resolve-service.ts)
-- creates/updates/merges profiles from the public widget path — no visitor
-- session exists there, so it uses the service-role client and manually
-- scopes every query to the resolved organizationId, exactly like the other
-- three documented CLAUDE.md §3.6 service-role contexts (AI Behaviour
-- config, knowledge retrieval, escalateToHuman). RLS below only governs the
-- authenticated company-dashboard path (modules/visitor-profiles/service.ts).
--
-- No DELETE policy: a visitor profile is a "real asset" once it exists —
-- same soft-delete-free posture as knowledge_documents/knowledge_collections
-- and widgets/widget_keys. There is no product requirement to permanently
-- erase a visitor's record in Phase 1.
alter table "visitor_profiles" enable row level security;

create policy "visitor_profiles_select"
on "visitor_profiles"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "visitor_profiles_insert"
on "visitor_profiles"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "visitor_profiles_update"
on "visitor_profiles"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));
