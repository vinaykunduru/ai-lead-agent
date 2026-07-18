# Integrations

Every third-party service this app talks to, and where that integration lives in code.

| Service | Purpose | Integration point | Docs |
|---|---|---|---|
| **Supabase** | Postgres hosting, Auth, Storage | `src/lib/supabase/*`, `src/db/client.ts` | [Database](../database/README.md), [Authentication](../authentication/README.md) |
| **Claude (Anthropic)** | AI provider option | `src/providers/ai/claude.ts` (raw `fetch`, no SDK) | [AI — Providers](../ai/README.md#providers) |
| **OpenAI** | AI provider option | `src/providers/ai/openai.ts` | [AI — Providers](../ai/README.md#providers) |
| **Gemini (Google)** | AI provider option | `src/providers/ai/gemini.ts` | [AI — Providers](../ai/README.md#providers) |
| **Llama-compatible** (Groq, Together, self-hosted vLLM/Ollama, etc.) | AI provider option | `src/providers/ai/llama.ts` | [AI — Providers](../ai/README.md#providers) |
| **Voyage AI** | Embeddings for the Knowledge Base | `src/providers/embeddings/voyage.ts` | [Knowledge Base — Embeddings](../knowledge-base/README.md#embeddings) |
| **Inngest** | Background job orchestration | `src/providers/jobs/`, `src/app/api/inngest/route.ts` | [Knowledge Base — Background job wiring](../knowledge-base/README.md#background-job-wiring) |
| **Sentry** | Error tracking | Root-level Sentry config files, `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_AUTH_TOKEN` | [Operations — Monitoring](../operations/README.md#monitoring) |
| **Vercel** | Hosting | N/A (platform, not a code dependency) | [Deployment](../deployment/README.md) |

## Adding a new integration

Per [`CLAUDE.md`](../../CLAUDE.md) §2: business modules never import a vendor SDK directly. A new provider of a kind Phase 1 already has an abstraction for (another AI vendor, another embeddings vendor) goes through the existing interface in `src/providers/ai/` or `src/providers/embeddings/` — implement the interface, add it to the relevant registry, done. A genuinely new *category* of integration (not covered by `providers/ai`, `providers/embeddings`, `providers/storage`, or `providers/jobs`) needs a new provider seam of its own — don't reach for a vendor SDK from inside a `modules/*/service.ts` file directly, and don't build a speculative interface for a provider nothing calls yet (`CLAUDE.md` §8).

Related: [Architecture — Provider abstractions](../architecture/README.md#provider-abstractions) · [Getting Started — Environment variables](../getting-started/README.md#environment-variables)
