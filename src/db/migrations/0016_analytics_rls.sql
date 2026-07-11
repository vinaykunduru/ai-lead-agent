-- Row-Level Security for Phase 7 (Analytics & AI Insights) — the two new
-- tables this phase actually adds. Every other analytics view in this
-- module reads existing, already-RLS-protected tables (conversations,
-- conversation_messages, conversation_usage, conversation_citations, leads,
-- lead_activity, knowledge_documents, knowledge_chunks,
-- knowledge_search_logs) through withRlsContext exactly like every prior
-- phase — no new read policies are needed for those.

alter table "analytics_alert_rules" enable row level security;

-- Full CRUD for a company's own alert rules — pure company-owned
-- configuration with no audit/history requirement in the module spec,
-- same posture as ai_business_rules (module spec: business rules are a
-- freely editable list a company can add/remove from at will).
create policy "analytics_alert_rules_select_own_org"
on "analytics_alert_rules"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "analytics_alert_rules_insert_own_org"
on "analytics_alert_rules"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "analytics_alert_rules_update_own_org"
on "analytics_alert_rules"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));

create policy "analytics_alert_rules_delete_own_org"
on "analytics_alert_rules"
for delete
to authenticated
using (organization_id in (select public.active_organization_ids()));

alter table "dashboard_preferences" enable row level security;

-- Singleton per-org config row — same select/insert/update, no-delete
-- pattern as ai_business_hours / ai_handoff_settings. The row is always
-- upserted (ensureDashboardPreferences), never deleted independently of
-- the organization itself (which cascades).
create policy "dashboard_preferences_select_own_org"
on "dashboard_preferences"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "dashboard_preferences_insert_own_org"
on "dashboard_preferences"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "dashboard_preferences_update_own_org"
on "dashboard_preferences"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));
