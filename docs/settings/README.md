# Settings

## Current status

`/app/settings` (`src/app/app/settings/page.tsx`) is a **placeholder** in the current codebase — it renders an empty state ("Settings aren't available yet — This module will be built in a later phase") and has no backing service or API routes yet. This page documents that honestly rather than describing unbuilt functionality.

## What company-level configuration exists today

Settings that a company can actually configure live in their respective modules rather than a unified Settings screen:

| Setting | Where it actually lives |
|---|---|
| AI assistant behavior | [AI Behaviour](../ai/README.md#ai-behaviour-module) (`/app/ai-behaviour`) |
| Widget appearance/behaviour/domains | [Widget](../widget/README.md) (`/app/widget/[widgetId]/*`) |
| Team members and roles | [Authorization → Users & Team](../authorization/README.md#users--team) (`/app/team`) |
| Lead pipeline stages | [Leads](../api/leads.md) (`/app/leads` → stage management) |
| Company profile (name, slug, logo, industry, timezone) | Currently platform-admin-only, via [Company Management](../architecture/company-management.md) — not yet self-service |

## Planned scope

A future phase would likely consolidate company profile self-service (name/logo/timezone editing without platform-admin involvement) here. No such work is scheduled or implemented as of this documentation — do not build against fields or endpoints described elsewhere as "future."
