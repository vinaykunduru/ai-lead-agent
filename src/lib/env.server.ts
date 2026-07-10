import "server-only";
import { z } from "zod";

// .env files (including our own .env.example) represent "not configured
// yet" as a declared-but-empty var (e.g. `ANTHROPIC_API_KEY=`), which is an
// empty string in process.env, not undefined. Plain `.optional()` only
// exempts undefined, so it was rejecting real, correctly-formatted .env
// files — this preprocessor makes "" behave the same as "not set".
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required — server-only, never expose to the client"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (Supabase Postgres connection string)"),
  ANTHROPIC_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  VOYAGE_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  INNGEST_EVENT_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  INNGEST_SIGNING_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  SENTRY_AUTH_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      "Invalid server environment variables:",
      parsed.error.flatten().fieldErrors,
    );
    throw new Error(
      "Invalid server environment variables. Check .env.local against .env.example.",
    );
  }
  return parsed.data;
}

/**
 * Server-only environment variables. Importing this module from a Client
 * Component is a build error (enforced by the `server-only` package) —
 * that is intentional and must never be worked around.
 */
export const serverEnv = load();
