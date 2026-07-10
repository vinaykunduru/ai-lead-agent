import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseProxyClient } from "@/lib/supabase/proxy";

/**
 * First gate only. Refreshes the Supabase session cookie and bounces
 * obviously-unauthenticated requests away from /admin and /app for a clean
 * UX. It is NOT the security boundary — per Next.js's own guidance, a
 * matcher change or refactor can silently remove proxy coverage, so every
 * layout, Server Action, and Route Handler re-verifies auth/authorization
 * itself (see CLAUDE.md §9). Role, org membership, and suspended-company
 * checks happen there, not here, so this file stays thin and auditable.
 */
export async function proxy(request: NextRequest) {
  const { supabase, response } = createSupabaseProxyClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtectedRoute = pathname.startsWith("/admin") || pathname.startsWith("/app");

  if (isProtectedRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|widget\\.js|api/widget).*)",
  ],
};
