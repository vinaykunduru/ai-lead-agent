"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env.public";

/**
 * Supabase client for Client Components (e.g. the login form). Uses only
 * the public anon key — never the service role key.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
