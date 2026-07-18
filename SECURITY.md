# Security Policy

## Reporting a vulnerability

This is a private repository. If you have access to it and discover a security vulnerability, please report it directly to the maintainer (vinaykunduru@gmail.com) rather than opening a public issue. Include:

- A description of the vulnerability and its potential impact
- Steps to reproduce (a minimal repro is ideal)
- Any relevant logs, screenshots, or request/response examples (redact real customer data)

Please do not test against the production deployment (`https://agent.bloomdigital.co.in`) with anything beyond what's needed to confirm the issue — use a local or staging environment for further exploration.

## Scope

This platform is multi-tenant SaaS handling company and end-visitor data. Reports of particular interest:

- Any way one organization's data becomes visible or writable to another (see [Multi-tenancy](./docs/security/README.md#tenant-isolation))
- Any way a company user reaches Platform Admin functionality, or vice versa
- Any way the public embedded widget can be used to exfiltrate data beyond what it's designed to expose, or to reach another organization's widget/knowledge base
- Secret exposure (service-role key, AI provider keys) in a client bundle, log, or error response
- Authentication/session bypass
- SQL injection, XSS, CSRF, or other OWASP Top 10 classes

## Security model summary

Full detail lives in [`docs/security/README.md`](./docs/security/README.md) and the normative source, [`CLAUDE.md`](./CLAUDE.md). In brief:

- **Two-layer tenant isolation**: application-level `organization_id` scoping (never trusted from the client) plus Postgres Row-Level Security, enabled by default-deny on every tenant table.
- **Structurally separate Platform Admin access**: gated by a dedicated `platform_admins` table check, independent of any organization membership.
- **Server-only secrets**: the Supabase service-role key and all AI/embeddings provider keys never reach the client bundle; validated at startup, never logged.
- **Defense in depth on the public widget surface**: public key resolution + domain allowlist + rate limiting, with every rejection reason collapsed to one generic error.
- **Append-only audit log**: no update/delete path exists for audit entries at the database level.

## Supported versions

This is a continuously-deployed single-environment application (see [`docs/deployment/README.md`](./docs/deployment/README.md)) — only the latest deployed version on `main` is supported. There is no LTS branch.
