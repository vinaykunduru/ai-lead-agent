# Troubleshooting

Quick reference. Full detail, including root causes and historical incidents: [`docs/troubleshooting/README.md`](./docs/troubleshooting/README.md).

| Symptom | Likely cause | Where to look |
|---|---|---|
| `tsc --noEmit` fails inside `@hookform/resolvers` | `zod` bumped past `~4.0.17` | [docs](./docs/troubleshooting/README.md#build--typecheck-issues) |
| `EMAXCONNSESSION` in Vercel logs | Postgres pooler exhausted | [docs](./docs/troubleshooting/README.md#database--connection-issues) |
| Local dev can't connect to Supabase (`ENOTFOUND`) | Using "Direct connection" instead of "Session pooler" | [docs](./docs/troubleshooting/README.md#database--connection-issues) |
| RLS query returns nothing unexpectedly | Missing `SET ROLE authenticated` grant, suspended org, or missing policy | [docs](./docs/troubleshooting/README.md#database--connection-issues) |
| Invite email link fails | `redirectTo` not on Supabase's allowlist | [docs](./docs/troubleshooting/README.md#supabase--auth-issues) |
| `/auth/confirm` doesn't establish a session | Don't convert it to a Route Handler — see why | [docs](./docs/troubleshooting/README.md#authconfirm-doesnt-establish-a-session) |
| Document stuck processing/failed | Check the document detail page's `errorMessage`, then Inngest dashboard | [docs](./docs/troubleshooting/README.md#knowledge-base-import--embedding-issues) |
| `ERR_REQUIRE_ESM` crash in `/api/inngest` | `jsdom` reintroduced — use `linkedom` | [docs](./docs/troubleshooting/README.md#err_require_esm-crash-in-apiinngest) |
| Widget doesn't load on a customer site | Widget status, domain allowlist, or a rotated key | [docs](./docs/troubleshooting/README.md#widget-issues) |
| A region of a page renders empty despite data loading | Check computed box dimensions in DevTools before assuming a data bug — likely a CSS Grid/flex collapse, not missing data | [docs](./docs/troubleshooting/README.md#layout--css-issues-that-only-appear-in-production) |

**General rule for this app**: if something doesn't reproduce in `next dev`, don't conclude it's fixed — reproduce against a real production build (`pnpm build && pnpm start`) or real production logs before ruling out a fix. Several real incidents here only manifested under production conditions.
