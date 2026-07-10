import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env.public";
import { serverEnv } from "@/lib/env.server";

/**
 * Service-role Supabase client. Bypasses RLS and Auth entirely.
 *
 * Restricted, per CLAUDE.md §3.6, to: the platform-admin module (e.g.
 * creating a company owner via `auth.admin.inviteUserByEmail`) and public
 * widget endpoints. Never use this for ordinary tenant data reads/writes —
 * use `withRlsContext` from `@/db/client` instead.
 */
export function createSupabaseAdminClient() {
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
