-- Row Level Security for the AI Behaviour module. Uses
-- public.active_organization_ids() (migration 0003), the same helper every
-- other tenant table's RLS policy uses, for the same infinite-recursion-
-- avoidance reason.
--
-- Unlike knowledge_collections/knowledge_documents (real knowledge assets
-- with a "no permanent delete" policy — see migration 0005), the tables
-- here are small, user-authored configuration: a singleton profile per org,
-- and two short ordered lists (business rules, lead questions) a company
-- edits directly. Real deletes are appropriate for list items a company
-- removes (e.g. "we no longer ask for budget") — there is no compliance
-- reason to keep them around soft-deleted.

-- ai_profiles: one row per org, lazily created on first access (see
-- modules/ai-behaviour/profile-service.ts). No DELETE policy — there is no
-- "delete my AI profile" feature; a company edits it, it never disappears.
alter table "ai_profiles" enable row level security;

create policy "ai_profiles_select"
on "ai_profiles"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "ai_profiles_insert"
on "ai_profiles"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "ai_profiles_update"
on "ai_profiles"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));

-- ai_business_rules: a company-editable ordered list. Full CRUD, scoped to
-- the caller's own org on every operation.
alter table "ai_business_rules" enable row level security;

create policy "ai_business_rules_select"
on "ai_business_rules"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "ai_business_rules_insert"
on "ai_business_rules"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "ai_business_rules_update"
on "ai_business_rules"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));

create policy "ai_business_rules_delete"
on "ai_business_rules"
for delete
to authenticated
using (organization_id in (select public.active_organization_ids()));

-- ai_lead_questions: same shape as ai_business_rules.
alter table "ai_lead_questions" enable row level security;

create policy "ai_lead_questions_select"
on "ai_lead_questions"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "ai_lead_questions_insert"
on "ai_lead_questions"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "ai_lead_questions_update"
on "ai_lead_questions"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));

create policy "ai_lead_questions_delete"
on "ai_lead_questions"
for delete
to authenticated
using (organization_id in (select public.active_organization_ids()));

-- ai_business_hours: one row per org, same shape as ai_profiles.
alter table "ai_business_hours" enable row level security;

create policy "ai_business_hours_select"
on "ai_business_hours"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "ai_business_hours_insert"
on "ai_business_hours"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "ai_business_hours_update"
on "ai_business_hours"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));

-- ai_handoff_settings: one row per org, same shape as ai_profiles.
alter table "ai_handoff_settings" enable row level security;

create policy "ai_handoff_settings_select"
on "ai_handoff_settings"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "ai_handoff_settings_insert"
on "ai_handoff_settings"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "ai_handoff_settings_update"
on "ai_handoff_settings"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));
