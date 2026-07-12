import { NextResponse, type NextRequest } from "next/server";
import { sendMessageSchema } from "@/modules/conversation/validation";
import { handleIncomingMessage } from "@/modules/conversation/execution-pipeline";
import { createSseResponse } from "@/modules/conversation/transport/sse";
import { extractOriginHost } from "@/modules/widget/resolve-public-request";
import { isRateLimited } from "@/modules/widget/rate-limit";

/**
 * Echoes the caller's Origin back as Access-Control-Allow-Origin, same
 * posture as /api/widget/config: safe to let any browser read a response
 * this endpoint already decided to return, because the real access
 * decision (does this widget key + domain combination resolve at all) is
 * made server-side inside handleIncomingMessage, not by this header. Every
 * response path here — success, rate-limited, invalid input — gets it, so
 * a cross-origin embed (i.e. every real deployment: the widget always runs
 * on the *customer's* domain, never this API's own) can actually read the
 * response instead of the browser silently blocking it pre-flight.
 */
function withCors<T extends Response>(response: T, request: NextRequest): T {
  const originHeader = request.headers.get("origin");
  if (originHeader) {
    response.headers.set("Access-Control-Allow-Origin", originHeader);
    response.headers.set("Vary", "Origin");
  }
  return response;
}

/**
 * Public, unauthenticated — the embed SDK POSTs here and reads back an SSE
 * stream (module spec §5/§8). A regular `EventSource` can't be used
 * because it only supports GET; the SDK instead reads `response.body` as a
 * stream and parses the same `data: {...}\n\n` framing manually (see
 * modules/widget/sdk-source.ts) — the wire format is still genuine SSE,
 * only the transport-level request method differs from the native browser
 * API's assumptions.
 */
export async function POST(request: NextRequest) {
  const rateLimitKey = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(rateLimitKey)) {
    return withCors(NextResponse.json({ error: "Too many requests" }, { status: 429 }), request);
  }

  const body = await request.json().catch(() => null);
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return withCors(
      NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 }),
      request,
    );
  }

  const originHost = extractOriginHost(request.headers);

  const response = createSseResponse(async (transport, signal) => {
    await handleIncomingMessage(parsed.data, originHost, transport, signal);
  }, request.signal);
  return withCors(response, request);
}

/**
 * A JSON POST is a "preflighted" cross-origin request (Content-Type:
 * application/json isn't a CORS-simple content type) — without this, the
 * browser never even sends the POST above; it just fails the OPTIONS
 * preflight and surfaces a generic "Failed to fetch" to the SDK. This is
 * required for every real deployment, since the widget always runs on the
 * customer's own domain (e.g. bloomdigital.co.in) rather than this API's
 * domain (agent.bloomdigital.co.in).
 */
export async function OPTIONS(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  const response = new NextResponse(null, { status: 204 });
  if (originHeader) {
    response.headers.set("Access-Control-Allow-Origin", originHeader);
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
    response.headers.set("Vary", "Origin");
  }
  return response;
}
