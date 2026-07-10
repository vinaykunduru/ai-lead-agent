import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Matches Supabase's EmailOtpType values. Validated against an allowlist
// rather than trusting the query string directly — this value flows into
// supabase.auth.verifyOtp().
const otpTypeSchema = z.enum(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

function sanitizeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

/**
 * Exchanges a Supabase email-link token (invite, recovery, etc.) for a
 * session. This is the trust boundary for the invitation flow: Supabase Auth
 * owns the token's lifecycle entirely (issuance, expiry, single-use
 * consumption) — we never see or store the token beyond this one request,
 * and this route does nothing but ask Supabase "is this token valid," then
 * redirects. See CLAUDE.md §3 for why this is a deliberate exception to
 * "never trust client input": the token itself is the credential, verified
 * by Supabase, not by us.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const typeResult = otpTypeSchema.safeParse(searchParams.get("type"));
  const next = sanitizeNextPath(searchParams.get("next"));

  if (tokenHash && typeResult.success) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({
      type: typeResult.data,
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/login?notice=invite_invalid", origin));
}
