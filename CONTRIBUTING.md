# Contributing

## Start here

Read [`CLAUDE.md`](./CLAUDE.md) before making changes — it's the permanent, authoritative source of truth for architecture and security rules in this repo, and it overrides convenience or "just this once" exceptions. This file covers day-to-day workflow; `CLAUDE.md` covers the rules that must survive across every change.

## Folder structure

```
src/
  app/            # Next.js App Router — admin/, app/, auth/, api/, widget/
  modules/        # Business logic — one folder per domain (Data Access Layer)
  providers/      # Vendor-abstracted seams — ai/, embeddings/, storage/, jobs/
  db/             # Drizzle schema, migrations, client
  lib/            # Cross-cutting: auth/, env, Supabase clients
  components/ui/  # shadcn/ui primitives
  shared/         # App-specific shared components (DashboardShell, skeletons, etc.)
docs/             # This documentation system
```

See [Architecture](./docs/architecture/README.md) for how these fit together.

## Coding standards

- **TypeScript strict** — never weaken strictness to make an error go away. `any` requires a documented inline reason.
- **Data Access Layer**: database/service-role/vendor-API access lives only in `modules/*/service.ts` and `db/queries`, marked `import "server-only"`. Server Components/Actions call into this layer, never hold a client or secret directly.
- **Centralized permissions**: never `if (role === "admin")` — always `can(session, permission)` / `assertPermission(session, permission)`. See [Authorization](./docs/authorization/README.md).
- **Every Server Action and Route Handler re-verifies auth and permission itself**, even if only reachable from an already-guarded page — `src/proxy.ts` is a first gate, not the security boundary.
- **Provider abstractions only where Phase 1 actually needs them** — business modules never import a vendor SDK directly; don't create speculative interfaces for providers nothing calls yet.
- **No new dependency without a stated reason** — say what it replaces or enables; prefer an existing dependency if suitable.
- **Multi-tenancy**: `organization_id` is always resolved server-side, never trusted from the client. Every new tenant table ships RLS in the same migration that creates it. See [Database — RLS](./docs/database/rls.md).
- Naming, formatting: ESLint + TypeScript's own compiler are the enforced standards — `pnpm lint` and `pnpm typecheck` must both pass clean, not just "pass with warnings you plan to fix later."

## Git workflow

- Work on a feature branch off `main`; open a PR rather than pushing directly to `main`.
- Commit message format used throughout this repo's history: `<type>: <summary>`, imperative mood, lowercase type — `feat:`, `fix:`, `refactor:`, `docs:`, `test:`. Example: `fix: cap Postgres client connections to prevent pool exhaustion`.
- Small, reviewable commits over one giant one — this repo's own history favors one logical change per commit.
- Never force-push to `main`; never skip hooks (`--no-verify`) or bypass signing without an explicit, separately-stated reason.

## Before opening a PR

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

All four must pass. If your change touches tenant data, also confirm the relevant [cross-tenant isolation test](./docs/testing/README.md#cross-tenant-isolation-tests) passes against a real (disposable/staging) Supabase project — a skip is not a pass.

## PR checklist

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all pass
- [ ] Any new tenant table has RLS enabled + a policy in the same migration
- [ ] Any new tenant-data module has a cross-tenant isolation test
- [ ] No secret or service-role key reachable from a client bundle
- [ ] No unrelated changes bundled into the PR
- [ ] If a rule in `CLAUDE.md` needed to change, that's called out explicitly in the PR description, not silently done
- [ ] Documentation updated if the change affects a documented API, schema, or module ([`docs/`](./docs/README.md))

## Review checklist (for reviewers)

- Does every new Server Action/Route Handler re-verify auth and permission itself, rather than relying on a page-level check?
- Is `organization_id` resolved server-side everywhere it's used, never taken from client input?
- Does a new tenant table have RLS + policies in the same migration, and does a corresponding isolation test exist?
- Are error messages/audit log metadata free of secrets, tokens, and full request bodies?
- Is any new dependency justified, and does it replace/enable something specific rather than being convenience-only?

## Working with Claude Code in this repo

This repo has been built substantially with Claude Code, guided by [`CLAUDE.md`](./CLAUDE.md)'s working agreement (§10): inspect before writing, work in small reviewable phases, no unrelated changes bundled in, no silent architecture changes, never bypass auth/RLS "temporarily." Human contributors are held to the same standards.
