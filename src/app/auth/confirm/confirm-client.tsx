"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

function sanitizeNextPath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

type EmailOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";
const EMAIL_OTP_TYPES: readonly string[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isEmailOtpType(value: string): value is EmailOtpType {
  return EMAIL_OTP_TYPES.includes(value);
}

/**
 * Exchanges a Supabase email-link token (invite, recovery, etc.) for a
 * session. This must run client-side: depending on how the connected
 * Supabase project is configured, the token arrives one of two ways —
 * `#access_token=...&refresh_token=...` (implicit flow, a URL hash
 * fragment the server never receives at all, by HTTP/URL spec) or
 * `?token_hash=...&type=...` (explicit flow, server-visible). A
 * server-only Route Handler can only ever see the second form; handling
 * both here is what actually works regardless of project configuration.
 *
 * Trust boundary unchanged from the original design (CLAUDE.md §3.11):
 * Supabase Auth owns the token's validity/expiry/single-use consumption
 * entirely. This component does nothing but ask Supabase "is this valid"
 * via `setSession`/`verifyOtp` and redirect — it holds no token state.
 */
export function ConfirmClient({
  next,
  tokenHash,
  type,
}: {
  next?: string;
  tokenHash?: string;
  type?: string;
}) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const supabase = createSupabaseBrowserClient();
      const nextPath = sanitizeNextPath(next);

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!cancelled) {
          if (error) setFailed(true);
          else router.replace(nextPath);
        }
        return;
      }

      if (tokenHash && type && isEmailOtpType(type)) {
        const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
        if (!cancelled) {
          if (error) setFailed(true);
          else router.replace(nextPath);
        }
        return;
      }

      if (!cancelled) setFailed(true);
    }

    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (failed) {
      router.replace("/login?notice=invite_invalid");
    }
  }, [failed, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <p className="text-sm text-muted-foreground">Confirming your invite...</p>
    </div>
  );
}
