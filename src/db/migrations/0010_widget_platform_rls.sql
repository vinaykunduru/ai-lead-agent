-- Row Level Security for the Widget Platform module. Uses
-- public.active_organization_ids() (migration 0003), the same helper every
-- other tenant table's RLS policy uses.
--
-- The PUBLIC widget config endpoint (modules/widget/public-config-service.ts)
-- does not use these policies at all — it is one of the four documented
-- service-role exceptions in CLAUDE.md §3.6 ("Public widget endpoints: no
-- visitor session exists"), and manually scopes every query itself. RLS
-- here only governs the authenticated company-dashboard path.

-- widgets: no DELETE policy — "Delete Widget" (the API's DELETE endpoint)
-- sets status to 'archived' via UPDATE, the same soft-delete-via-status
-- pattern already used for knowledge_documents/knowledge_collections.
alter table "widgets" enable row level security;

create policy "widgets_select"
on "widgets"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "widgets_insert"
on "widgets"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "widgets_update"
on "widgets"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));

-- widget_keys: rotation is "insert a new active row, then update the old
-- row to revoked" (modules/widget/keys-service.ts) — both are ordinary
-- RLS-scoped writes by the widget's own org, no service-role needed. No
-- DELETE policy: every key ever issued stays visible for audit purposes
-- ("Audit every rotation").
alter table "widget_keys" enable row level security;

create policy "widget_keys_select"
on "widget_keys"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "widget_keys_insert"
on "widget_keys"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "widget_keys_update"
on "widget_keys"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));

-- widget_domains: a company-editable list (add/remove/enable/disable) —
-- full CRUD, same shape as ai_business_rules.
alter table "widget_domains" enable row level security;

create policy "widget_domains_select"
on "widget_domains"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "widget_domains_insert"
on "widget_domains"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "widget_domains_update"
on "widget_domains"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));

create policy "widget_domains_delete"
on "widget_domains"
for delete
to authenticated
using (organization_id in (select public.active_organization_ids()));

-- widget_themes: one row per widget (Appearance). No DELETE — a widget
-- always has exactly one theme row once touched.
alter table "widget_themes" enable row level security;

create policy "widget_themes_select"
on "widget_themes"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "widget_themes_insert"
on "widget_themes"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "widget_themes_update"
on "widget_themes"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));

-- widget_settings: one row per widget (Behaviour). Same shape as
-- widget_themes.
alter table "widget_settings" enable row level security;

create policy "widget_settings_select"
on "widget_settings"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "widget_settings_insert"
on "widget_settings"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "widget_settings_update"
on "widget_settings"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));
