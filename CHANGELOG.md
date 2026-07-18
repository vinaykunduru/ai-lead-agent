# Changelog

All notable changes to this project, derived from the repository's git tag and commit history. Format loosely follows [Keep a Changelog](https://keepachangelog.com/); versioning follows semver-style `MAJOR.MINOR.PATCH` as used in this repo's actual git tags.

## [v0.9.0-enterprise-ui-polish] — 2026-07-18

Covers everything since v0.8.0:

- Full design-system refinement (typography/shadow scale, sidebar, header, tables, login) and a global loading/feedback system (route progress bar, skeletons, button loading states, cursor states) across all modules.
- Module-by-module premium polish pass: Dashboard and Admin Overview rebuilt as real executive overviews; consistent table/card treatment everywhere; missing loading states and destructive-action feedback filled in.
- **Fixed**: RSC serialization crash on `/app` and `/admin` — `NavItem.icon` carried raw component references across the Server→Client boundary; now pre-rendered as JSX.
- **Fixed**: Postgres connection pool exhaustion (`EMAXCONNSESSION`) in production — Postgres client capped at `max: 1` per instance.
- **Fixed**: `jsdom` ESM incompatibility crashing `/api/inngest` in production — replaced with `linkedom` for website-import extraction.
- **Fixed**: CSS Grid `min-width` collapse hiding real content (Conversation/Lead Timeline cards rendering as a `0 × Npx` box in production builds).
- **Fixed**: retrieved knowledge chunks were computed but never actually injected into the AI system prompt — a real grounding bug.
- **Fixed**: widget duplicate-message race condition (polling could race a message's own SSE stream) and markdown rendering in widget replies.

## [v0.8.0] — 2026-07-12

Phase 8 complete — Vercel deployment preparation and the AI Conversation Engine groundwork that followed Analytics.

## [v0.7.0-analytics] — 2026-07-12

Analytics & AI Insights complete: 7 aggregation domains (executive summary, leads, conversations, AI performance, widgets, inbox, knowledge base), alert rules, dashboard preferences, CSV/JSON export, hand-rolled SVG chart primitives (no new charting dependency).

## [v0.6.0-lead-management] — 2026-07-11

Lead Management & Human Inbox complete: lead CRUD, pipeline stages, tags, notes, assignments, AI-generated lead summaries and scoring, CSV export, human takeover/reply/resume flow, widget SDK polling for human replies.

## [v0.5.0-conversation-engine] — 2026-07-11

Conversation Engine complete: `providers/ai` (Claude, OpenAI, Gemini, Llama-compatible), transport abstraction with an SSE adapter, structured-prompt rendering, the Conversation Inspector UI, and real streaming wired into the widget SDK.

## [v0.4.0-widget-platform] — 2026-07-11

Widget Platform complete: widget CRUD, appearance/behaviour configuration, public key resolution, domain allowlisting, the embed SDK, and public/company-side API routes.

## [v0.3] — AI Behaviour (untagged)

Structured AI configuration (identity, personality, response settings, business hours/rules, lead-qualification questions, handoff settings), the system-prompt generator, and per-vendor prompt renderers. Not tagged individually in git; folded into the range leading up to v0.4.0.

## [v0.2.0-knowledge-base] — 2026-07-11

Knowledge Base milestone complete: collections/documents, PDF/DOCX/website/text extraction, chunking, Voyage AI embeddings, Inngest-driven processing pipeline, pgvector semantic search.

## [v0.1] — Foundation (untagged)

Initial scaffold: multi-tenant Postgres schema with RLS, Platform Admin (companies CRUD, first-owner invite), Company Dashboard shell, centralized permissions module, cross-tenant isolation test suite, CI pipeline. First commit: 2026-07-10.

---

For unreleased/in-progress work, see open pull requests and the live [task list](./docs/README.md) referenced in project planning — this file reflects what has actually shipped (tagged or committed to `main`), not planned work.
