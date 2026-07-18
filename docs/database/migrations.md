# Migrations

Migrations live at `src/db/migrations/*.sql`, generated from schema diffs via `pnpm db:generate` (Drizzle Kit reads `src/db/schema/*.ts`) and applied via `pnpm db:migrate`. Snapshots used for diffing live in `src/db/migrations/meta/`.

Never hand-edit a migration file that has already been applied to any shared environment — generate a new migration instead.

| # | File | Summary |
|---|---|---|
| 0000 | `0000_*.sql` | Initial schema — core tenancy tables (`organizations`, `platform_admins`, `memberships`, `audit_logs`) |
| 0001 | `0001_*.sql` | Enable RLS on all Phase-1 tables |
| 0002 | `0002_*.sql` | Add `memberships_one_active_org_per_user` partial unique index; audit log indexes |
| 0003 | `0003_*.sql` | Fix RLS self-recursion via `active_organization_ids()` `SECURITY DEFINER` helper function |
| 0004 | `0004_*.sql` | Knowledge base tables (`knowledge_collections`, `knowledge_documents`, `knowledge_chunks`, `knowledge_search_logs`) |
| 0005 | `0005_*.sql` | Knowledge base RLS policies |
| 0006 | `0006_*.sql` | `audit_logs` — add company-scoped read access policy |
| 0007 | `0007_*.sql` | AI Behaviour tables (`ai_profiles`, `ai_business_rules`, `ai_lead_questions`, `ai_business_hours`, `ai_handoff_settings`) |
| 0008 | `0008_*.sql` | AI Behaviour RLS policies |
| 0009 | `0009_*.sql` | Widget Platform tables (`widgets`, `widget_keys`, `widget_domains`, `widget_themes`, `widget_settings`) |
| 0010 | `0010_*.sql` | Widget Platform RLS policies |
| 0011 | `0011_*.sql` | Conversation Engine tables (`conversation_sessions`, `conversations`, `conversation_messages`, `conversation_citations`, `conversation_usage`) + `ai_provider` column on `ai_profiles` |
| 0012 | `0012_*.sql` | Conversation Engine RLS policies (SELECT-only) |
| 0013 | `0013_*.sql` | Lead Management tables (`lead_stages`, `leads`, `lead_tags`, `lead_notes`, `lead_assignments`, `lead_stage_history`, `lead_scores`, `lead_activity`) + `owner`/`assigned_user_id`/`takeover_reason` columns on `conversations` (Human Inbox) |
| 0014 | `0014_*.sql` | Lead Management RLS policies + Inbox takeover policies (`conversations` UPDATE, `conversation_messages` INSERT) |
| 0015 | `0015_*.sql` | Analytics tables (`analytics_alert_rules`, `dashboard_preferences`) |
| 0016 | `0016_*.sql` | Analytics RLS policies |

Running `pnpm db:migrate` applies any migration not yet recorded as applied, in numeric order. There is no down-migration tooling in this repo — rollback is handled by writing a new forward migration, per standard Drizzle Kit practice.

Back to: [Database overview](./README.md) · [Row-Level Security](./rls.md)
