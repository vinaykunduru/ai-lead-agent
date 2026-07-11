-- Row Level Security for Lead Management + Human Inbox. Uses
-- public.active_organization_ids() (migration 0003), the same helper every
-- other tenant table's RLS policy uses.

-- lead_stages: company-configurable (module spec §1). No DELETE — a stage
-- with existing leads can't be removed anyway (leads.stage_id references
-- it ON DELETE RESTRICT); stages are archived by convention (excluded from
-- pipeline views), not deleted.
alter table "lead_stages" enable row level security;

create policy "lead_stages_select"
on "lead_stages"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "lead_stages_insert"
on "lead_stages"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "lead_stages_update"
on "lead_stages"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));

-- leads: full CRUD, including DELETE — unlike knowledge documents (no
-- permanent delete, by explicit module spec) leads has no such constraint,
-- and the module spec explicitly lists "leads.delete" as its own
-- permission (e.g. removing spam/test leads).
alter table "leads" enable row level security;

create policy "leads_select"
on "leads"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "leads_insert"
on "leads"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "leads_update"
on "leads"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));

create policy "leads_delete"
on "leads"
for delete
to authenticated
using (organization_id in (select public.active_organization_ids()));

-- lead_tags: add/remove, no update (removing + re-adding covers "rename").
alter table "lead_tags" enable row level security;

create policy "lead_tags_select"
on "lead_tags"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "lead_tags_insert"
on "lead_tags"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "lead_tags_delete"
on "lead_tags"
for delete
to authenticated
using (organization_id in (select public.active_organization_ids()));

-- lead_notes: create/delete only — content is never edited in place, so
-- there's no ambiguity about what an audited "note updated" event would
-- even mean; a correction is a new note plus deleting the old one.
alter table "lead_notes" enable row level security;

create policy "lead_notes_select"
on "lead_notes"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "lead_notes_insert"
on "lead_notes"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "lead_notes_delete"
on "lead_notes"
for delete
to authenticated
using (organization_id in (select public.active_organization_ids()));

-- lead_assignments / lead_stage_history / lead_scores / lead_activity:
-- append-only history/audit tables — select + insert only, matching
-- audit_logs' and knowledge_search_logs' existing posture. No table here
-- is ever updated or deleted through the RLS-scoped path.
alter table "lead_assignments" enable row level security;

create policy "lead_assignments_select"
on "lead_assignments"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "lead_assignments_insert"
on "lead_assignments"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

alter table "lead_stage_history" enable row level security;

create policy "lead_stage_history_select"
on "lead_stage_history"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "lead_stage_history_insert"
on "lead_stage_history"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

alter table "lead_scores" enable row level security;

create policy "lead_scores_select"
on "lead_scores"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "lead_scores_insert"
on "lead_scores"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

alter table "lead_activity" enable row level security;

create policy "lead_activity_select"
on "lead_activity"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "lead_activity_insert"
on "lead_activity"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

-- Human Inbox requires two narrow, additive extensions to conversations'
-- and conversation_messages' existing RLS posture (migration 0012), which
-- until now only ever granted "authenticated" SELECT — every write went
-- through the service-role conversation pipeline because only anonymous
-- visitors ever wrote to these tables. Human Takeover is the first case
-- where a real authenticated company user needs to write here directly:
-- taking over/resuming a conversation, marking it read, and sending a
-- human reply. This is scoped identically to every other RLS policy in
-- this file (organization-scoped via active_organization_ids()) — it does
-- not touch the transport abstraction, the execution pipeline, or the
-- public/visitor-facing write path, which remain entirely service-role.
create policy "conversations_update_by_agent"
on "conversations"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));

create policy "conversation_messages_insert_by_agent"
on "conversation_messages"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));
