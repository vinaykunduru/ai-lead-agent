import { NextResponse, type NextRequest } from "next/server";
import { publicWidgetConfigQuerySchema } from "@/modules/widget/validation";
import { resolvePublicWidgetConfig } from "@/modules/widget/public-config-service";
import { isRateLimited } from "@/modules/widget/rate-limit";

function extractOriginHost(request: NextRequest): string | null {
  const originHeader = request.headers.get("origin") ?? request.headers.get("referer");
  if (!originHeader) return null;
  try {
    return new URL(originHeader).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Public, unauthenticated — the embed SDK on a third-party site calls this
 * directly. Never returns anything beyond PublicWidgetConfig (see
 * modules/widget/public-config-service.ts's doc comment). Every rejection
 * reason maps to the same generic error and status, by design.
 */
export async function GET(request: NextRequest) {
  const rateLimitKey = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = publicWidgetConfigQuerySchema.safeParse({
    key: request.nextUrl.searchParams.get("key"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid widget configuration request" }, { status: 400 });
  }

  const originHost = extractOriginHost(request);

  try {
    const config = await resolvePublicWidgetConfig(parsed.data.key, originHost);
    const response = NextResponse.json(config);
    // Safe to let the browser read this cross-origin: resolvePublicWidgetConfig
    // already performed the real server-side domain validation above: this
    // header only controls whether the *browser* can read a response the
    // server already decided to return, not whether the request was
    // allowed at all.
    const originHeader = request.headers.get("origin");
    if (originHeader) {
      response.headers.set("Access-Control-Allow-Origin", originHeader);
      response.headers.set("Vary", "Origin");
    }
    return response;
  } catch {
    // Never echo the underlying error message shape here beyond the fixed
    // string below — resolvePublicWidgetConfig already guarantees a single
    // generic message, but this is the last line of defense against ever
    // leaking a stack trace or DB error to a public, unauthenticated caller.
    return NextResponse.json({ error: "Invalid widget configuration request" }, { status: 400 });
  }
}

export async function OPTIONS(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  const response = new NextResponse(null, { status: 204 });
  if (originHeader) {
    response.headers.set("Access-Control-Allow-Origin", originHeader);
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Vary", "Origin");
  }
  return response;
}
