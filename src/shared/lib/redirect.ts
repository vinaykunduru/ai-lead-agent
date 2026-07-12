/**
 * Open-redirect guard for any `next`/`redirect_to`-style query param this
 * app trusts to send a user back where they came from after auth. Only a
 * same-origin, path-rooted, non-protocol-relative string is allowed through
 * — anything else (an absolute URL, `//host` protocol-relative, or a bare
 * host) falls back to `/`. Shared by src/app/(auth)/login/page.tsx and
 * src/app/auth/confirm/confirm-client.tsx — previously two independent
 * copies of the same logic, which is exactly the kind of security-relevant
 * duplication that can silently drift out of sync.
 */
export function sanitizeNextPath(value: string | undefined | null): string {
  if (!value) return "/";
  // A leading space or control character defeats a naive startsWith("/")
  // check once concatenated into a URL by some consumers — reject anything
  // that doesn't start with "/" as the literal first character.
  if (!value.startsWith("/")) return "/";
  // "//evil.com" and "/\evil.com" are both browser-recognized
  // protocol-relative forms in some contexts (the backslash variant is
  // normalized to "//" by some URL parsers) — reject both leading forms,
  // not just the forward-slash one.
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
