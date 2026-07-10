import { z } from "zod";

// See the identical note in env.server.ts: a declared-but-empty .env var is
// "", not undefined, so plain `.optional()` doesn't exempt it.
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SENTRY_DSN: z.preprocess(emptyToUndefined, z.string().url().optional()),
});

function load() {
  // NEXT_PUBLIC_* values must be referenced statically (not via a loop or
  // dynamic key) so Next.js can inline them into the client bundle.
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  });
  if (!parsed.success) {
    console.error(
      "Invalid public environment variables:",
      parsed.error.flatten().fieldErrors,
    );
    throw new Error(
      "Invalid public environment variables. Check .env.local against .env.example.",
    );
  }
  return parsed.data;
}

/** Safe to import from both Server and Client Components. */
export const publicEnv = load();
