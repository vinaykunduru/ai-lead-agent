-- Row Level Security for the Knowledge Base module. Uses
-- public.active_organization_ids() (migration 0003) rather than a direct
-- self-join subquery, for the same reason it was introduced: avoids
-- "infinite recursion detected in policy" if any of these tables' policies
-- were ever written as a naive subquery against a table that itself has
-- policies referencing memberships.
--
-- Column-level write restriction (e.g. a company user should never set
-- knowledge_documents.chunk_count or embedding_status directly) is a
-- service-layer responsibility, not RLS — Postgres RLS is row-scoped, not
-- column-scoped. Every knowledge module service function only ever
-- constructs narrow, explicit `.set({...})` updates (see CLAUDE.md's
-- existing organizations module for the same pattern), never a pass-through
-- of arbitrary client input.

-- knowledge_collections: authenticated users can read, create, and update
-- (rename/archive/soft-delete are all UPDATEs) their own org's collections.
-- No DELETE policy — "No permanent delete by default" is enforced here at
-- the database layer, not just by omitting a delete button in the UI.
alter table "knowledge_collections" enable row level security;

create policy "knowledge_collections_select"
on "knowledge_collections"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "knowledge_collections_insert"
on "knowledge_collections"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "knowledge_collections_update"
on "knowledge_collections"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));

-- knowledge_documents: same shape as collections. Status/embedding_status/
-- chunk_count/token_count transitions during processing are written by the
-- background job via the service-role client (CLAUDE.md §3.6), not through
-- this RLS-scoped path, so no special-casing is needed here.
alter table "knowledge_documents" enable row level security;

create policy "knowledge_documents_select"
on "knowledge_documents"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "knowledge_documents_insert"
on "knowledge_documents"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));

create policy "knowledge_documents_update"
on "knowledge_documents"
for update
to authenticated
using (organization_id in (select public.active_organization_ids()))
with check (organization_id in (select public.active_organization_ids()));

-- knowledge_chunks: read-only for authenticated users (semantic search,
-- chunk viewer). All writes (insert on process, delete+reinsert on
-- reprocess) happen via the background job's service-role client — no
-- insert/update/delete policy is granted to "authenticated" at all.
alter table "knowledge_chunks" enable row level security;

create policy "knowledge_chunks_select"
on "knowledge_chunks"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

-- knowledge_search_logs: append-only from the searching user's own RLS
-- context (search and its log entry happen in the same withRlsContext
-- transaction — see modules/knowledge/search-service.ts). Readable so the
-- UI can show "Search Statistics" on a document's detail page. No
-- update/delete policy, matching audit_logs' append-only posture.
alter table "knowledge_search_logs" enable row level security;

create policy "knowledge_search_logs_select"
on "knowledge_search_logs"
for select
to authenticated
using (organization_id in (select public.active_organization_ids()));

create policy "knowledge_search_logs_insert"
on "knowledge_search_logs"
for insert
to authenticated
with check (organization_id in (select public.active_organization_ids()));
