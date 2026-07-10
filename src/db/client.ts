import "server-only";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/lib/env.server";
import * as schema from "./schema";

const queryClient = postgres(serverEnv.DATABASE_URL, { prepare: false });

/**
 * Service-role Drizzle instance. The underlying Postgres role bypasses RLS
 * entirely (Supabase's connection role has BYPASSRLS). Only import this from
 * code explicitly allowed to bypass RLS per CLAUDE.md §3.6: the platform-admin
 * module, job workers, and public widget endpoints — and every one of those
 * call sites must manually scope every query itself, since the database will
 * not do it for them.
 *
 * Do not use this for ordinary company/admin-dashboard reads or writes.
 * Use `withRlsContext` instead so Postgres RLS is actually enforced.
 */
export const db = drizzle(queryClient, { schema });

type RlsDb = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Runs `callback` inside a Postgres transaction with the session role
 * switched to `authenticated` and `auth.uid()` resolving to `userId`, so
 * every RLS policy in the database enforces tenant isolation exactly as it
 * would for a request made through Supabase's own client libraries. This is
 * the default, RLS-respecting path for all company and platform-admin
 * dashboard data access — see CLAUDE.md §3.
 *
 * `userId` must come from a verified Supabase session (never from client
 * input) — see lib/auth/session.ts.
 */
export async function withRlsContext<T>(
  userId: string,
  callback: (tx: RlsDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = JSON.stringify({ sub: userId, role: "authenticated" });
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return callback(tx);
  });
}
