-- Row Level Security for the Conversation Engine module. Uses
-- public.active_organization_ids() (migration 0003), the same helper every
-- other tenant table's RLS policy uses.
--
-- Unlike every prior module, NONE of these 5 tables gets an INSERT/UPDATE/
-- DELETE policy for "authenticated" — visitors never have a Supabase auth
-- session at all (they are anonymous, identified only by a client-generated
-- visitorId), so there is no "authenticated" RLS context these writes could
-- ever go through. Every write happens via the service-role client inside
-- the public conversation pipeline (modules/conversation/*), one of the
-- four documented CLAUDE.md §3.6 exceptions ("public widget endpoints"),
-- manually scoped to the widget/organization resolved from the validated
-- public key. This mirrors knowledge_chunks' existing posture exactly
-- (service-role-write-only, RLS SELECT-only for authenticated) — see
-- migration 0005's comment for the same reasoning.
--
-- SELECT is granted to "authenticated" on all 5 tables so the Conversation
-- Inspector (an authenticated company-dashboard screen) can read its own
-- org's conversation history — the same "RLS is exactly what this is for"
-- reasoning as audit_logs' migration 0006.

alter table "conversation_sessions" enable row level security;

create policy "conversation_sessions_select"
on "conversation_sessions"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

alter table "conversations" enable row level security;

create policy "conversations_select"
on "conversations"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

alter table "conversation_messages" enable row level security;

create policy "conversation_messages_select"
on "conversation_messages"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

alter table "conversation_citations" enable row level security;

create policy "conversation_citations_select"
on "conversation_citations"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

alter table "conversation_usage" enable row level security;

create policy "conversation_usage_select"
on "conversation_usage"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));
