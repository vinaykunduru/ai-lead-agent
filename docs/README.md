# AI Lead Agent — Documentation

Complete documentation for **AI Lead Agent** (deployed under the brand **Bloom**/**BloomAI**) — a multi-tenant SaaS platform that lets companies capture, qualify, and convert website visitors through an AI chat widget backed by a per-company knowledge base.

This documentation is organized by audience and by topic. If you're not sure where to start:

- **New developer, setting up locally?** → [Getting Started](./getting-started/README.md)
- **Understanding how the system fits together?** → [Architecture](./architecture/README.md)
- **Building against the API?** → [API Reference](./api/README.md)
- **Deploying or operating this in production?** → [Deployment](./deployment/README.md) and [Operations](./operations/README.md)
- **Something broken?** → [Troubleshooting](./troubleshooting/README.md)
- **Configuring the product as a company admin?** → [Module docs](#module-documentation) below
- **Contributing code?** → [Contributing](../CONTRIBUTING.md)

## How this documentation is organized

| Section | Audience | Contents |
|---|---|---|
| [`getting-started/`](./getting-started/README.md) | Developers | Local setup, environment variables, running the app |
| [`architecture/`](./architecture/README.md) | Developers, architects | System design, data flow diagrams, request lifecycles |
| [`backend/`](./backend/README.md) | Developers | Server-side module structure, Data Access Layer pattern |
| [`frontend/`](./frontend/README.md) | Developers | App Router structure, component system, design tokens |
| [`database/`](./database/README.md) | Developers, DBAs | Schema, relationships, RLS policies, migrations |
| [`authentication/`](./authentication/README.md) | Developers, admins | Login, invites, session model |
| [`authorization/`](./authorization/README.md) | Developers, admins | Roles, permissions, RLS enforcement |
| [`api/`](./api/README.md) | Developers, integrators | Every API route: auth, request/response, errors |
| [`ai/`](./ai/README.md) | Developers | Prompt assembly, retrieval, embeddings, providers |
| [`knowledge-base/`](./knowledge-base/README.md) | Admins, developers | Document import, chunking, processing, troubleshooting |
| [`widget/`](./widget/README.md) | Admins, integrators | Installation, configuration, security |
| [`conversations/`](./conversations/README.md) | Admins | The conversation inspector |
| [`inbox/`](./inbox/README.md) | Admins, agents | Human takeover workflow |
| [`analytics/`](./analytics/README.md) | Admins | Metrics, alerts, exports |
| [`settings/`](./settings/README.md) | Admins | Company and platform settings |
| [`deployment/`](./deployment/README.md) | DevOps | Vercel, Supabase, Inngest, CI/CD |
| [`integrations/`](./integrations/README.md) | Developers | Supabase, Inngest, Sentry, AI providers |
| [`testing/`](./testing/README.md) | Developers | Test strategy, running tests, coverage |
| [`troubleshooting/`](./troubleshooting/README.md) | Everyone | Common issues and fixes |
| [`security/`](./security/README.md) | Everyone | Security model and practices |
| [`operations/`](./operations/README.md) | DevOps | Monitoring, backups, incident response |
| [`contributing/`](./contributing/README.md) | Contributors | Coding standards, workflow |
| [`changelog/`](./changelog/README.md) | Everyone | Points to [`CHANGELOG.md`](../CHANGELOG.md) |

## Module documentation

Each product module has its own page covering purpose, features, roles, workflow, permissions, screens, related APIs, and database tables:

- [Authentication](./authentication/README.md)
- [Platform Admin](./architecture/platform-admin.md)
- [Company Management](./architecture/company-management.md)
- [Users & Team](./authorization/README.md#users--team)
- [Leads](./api/leads.md)
- [Conversations](./conversations/README.md)
- [Knowledge Base](./knowledge-base/README.md)
- [AI Behaviour](./ai/README.md#ai-behaviour-module)
- [Widget](./widget/README.md)
- [Analytics](./analytics/README.md)
- [Inbox](./inbox/README.md)
- [Settings](./settings/README.md)
- [Audit Logs](./security/README.md#audit-logs)

## Conventions used in this documentation

- **Permission strings** are written exactly as they appear in code, e.g. `leads.view`, `analytics.export`. See [Authorization](./authorization/README.md) for the full permission matrix.
- **Server-only** marks a value or module that must never reach the browser (enforced by the `server-only` package at build time).
- Diagrams use [Mermaid](https://mermaid.js.org/) — they render natively on GitHub and in most modern documentation tools.
- Code paths are repo-relative, e.g. `src/modules/leads/leads-service.ts`.

## Working title note

"AI Lead Agent" is the working/repo name established in [`CLAUDE.md`](../CLAUDE.md), the project's permanent architecture reference. The current production deployment is branded **Bloom** / **BloomAI**. Both names refer to the same codebase; documentation uses "AI Lead Agent" for technical/repo context and "Bloom" only when describing the live, branded product experience.
