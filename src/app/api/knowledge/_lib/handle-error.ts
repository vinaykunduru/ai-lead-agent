import { NextResponse } from "next/server";

/**
 * Maps a thrown service-layer Error to an appropriate HTTP status without
 * leaking internals. Service functions throw plain Errors with a small,
 * consistent set of message prefixes/suffixes (see lib/auth/session.ts,
 * lib/auth/platform-admin.ts, modules/permissions/can.ts, and this
 * module's own service files) — never a raw stack trace or DB error.
 */
export function knowledgeApiError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Something went wrong";

  if (message.startsWith("Unauthorized")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (message.startsWith("Forbidden")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (message.endsWith("not found")) {
    return NextResponse.json({ error: message }, { status: 404 });
  }
  return NextResponse.json({ error: message }, { status: 400 });
}
