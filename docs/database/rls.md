# Row-Level Security

Every tenant-owned table has RLS **enabled** and a **default-deny** posture — a table with no policy grants no access at all. This is the second, independent layer of tenant isolation (application-level `organization_id` scoping is the first) required by [`CLAUDE.md`](../../CLAUDE.md) §3.

## The `active_organization_ids()` helper

Migration `0003` replaced naive inline subqueries with a single `SECURITY DEFINER` SQL function, introduced specifically to fix RLS self-recursion (a policy on `memberships` that queries `memberships` to check membership recurses infinitely):

```sql
create or replace function public.active_organization_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select m.organization_id
  from memberships m
  join organizations o on o.id = m.organization_id
  where m.user_id = auth.uid()
    and m.status = 'active'
    and o.status <> 'suspended'
$$;
```

Every standard tenant-table policy reduces to:

```sql
using (organization_id in (select public.active_organization_ids()))
```

with a matching `with check (...)` clause for `INSERT`/`UPDATE`. Because the function also excludes suspended organizations (`o.status <> 'suspended'`), a suspended company's data becomes invisible even to its own members through the normal RLS-scoped query path — this is the mechanism behind CLAUDE.md §3.8 ("suspended company must lose access at both layers") and also why `lib/auth/suspended.ts` needs a service-role check to tell "suspended" apart from "not a member at all" (§3.6).

## Which Postgres role runs which query

- **Company Dashboard (`/app`) and normal authenticated queries** run through the user's own Supabase session/JWT — a `authenticated`-role connection that RLS actually applies to.
- **Platform Admin (`/admin`)** routes use the service-role client (RLS bypassed), gated instead by an independent `platform_admins` table check — not by `active_organization_ids()`.
- **Background jobs** (Inngest document processing) use the service-role client and manually scope every query by the `organizationId` carried in the job payload.
- **Public widget endpoints** (`/api/widget/*`) use the service-role client (no visitor session exists) and manually scope every query to the `organization_id`/`widget_id` resolved from the public widget key.

## Policy matrix by table group

| Table group | SELECT | INSERT | UPDATE | DELETE | Notes |
|---|---|---|---|---|---|
| `platform_admins` | — | — | — | — | RLS enabled, **zero policies** — deny-all for `authenticated`; service-role only |
| `audit_logs` | ✅ | — | — | — | Append-only; writes happen via server-side code or a `SECURITY DEFINER` function, never via `authenticated` |
| `knowledge_chunks` | ✅ | — | — | — | Written only by the document-processing job (service-role) |
| `conversation_sessions`, `conversations`, `conversation_messages`, `conversation_citations`, `conversation_usage` | ✅ | — | — | — | All SELECT-only, **except** two narrow migration-0014 additions for Human Inbox: `conversations` gets `UPDATE`, `conversation_messages` gets `INSERT` (so an agent's reply through `/api/inbox/:id/reply` can be written under the user's own RLS-scoped session) |
| `knowledge_search_logs` | ✅ | ✅ | — | — | Company-admin manual searches are logged by the user's own session |
| `lead_assignments`, `lead_stage_history`, `lead_scores`, `lead_activity` | ✅ | ✅ | — | — | Append-only audit trails |
| `lead_tags`, `lead_notes` | ✅ | ✅ | — | ✅ | No UPDATE — a note/tag is deleted and recreated, never edited in place |
| `leads` | ✅ | ✅ | ✅ | ✅ | The one lead-adjacent table with full CRUD including hard DELETE |
| `knowledge_collections`, `knowledge_documents`, `widgets`, `widget_keys` | ✅ | ✅ | ✅ | — | "Real asset" tables — product rule is soft-delete/archive only, so no DELETE policy exists at all |
| Singleton config tables (`ai_profiles`, `ai_business_hours`, `ai_handoff_settings`, `widget_themes`, `widget_settings`, `dashboard_preferences`) | ✅ | ✅ | ✅ | — | One row per org/widget; no DELETE (nothing to delete) |
| Ordered-list tables (`ai_business_rules`, `ai_lead_questions`, `widget_domains`, `analytics_alert_rules`) | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| `lead_stages` | ✅ | ✅ | ✅ | — | No DELETE policy — `leads.stage_id` is `ON DELETE RESTRICT`, so the FK constraint would reject it anyway; the missing policy makes the intent explicit |
| `memberships` | ✅ | ✅* | ✅* | — | *Membership creation/role changes in Phase 1 go through platform-admin-triggered invite flows (service-role), not direct `authenticated` writes — see [`authentication/README.md`](../authentication/README.md) |
| `organizations` | ✅ | — | ✅* | — | Org creation is platform-admin-only (service-role); company users can update limited fields of their own org |

## What every new tenant table must ship with

Per CLAUDE.md §3.3: **no table goes live without an RLS policy in the same migration that creates the table.** When adding a table:

1. `alter table <name> enable row level security;`
2. At minimum a `SELECT` policy using `active_organization_ids()`.
3. Matching `INSERT`/`UPDATE`/`DELETE` policies only for the operations the product actually needs — omitting a policy is the correct way to deny an operation, not an oversight to "fix" later.
4. If the table needs to be visible cross-tenant to platform admins, that access goes through the service-role client with an explicit `platform_admins` check — never by widening the tenant policy.

Back to: [Database overview](./README.md) · [Migrations](./migrations.md)
