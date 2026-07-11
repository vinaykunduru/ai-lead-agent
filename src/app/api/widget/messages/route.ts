import { NextResponse, type NextRequest } from "next/server";
import { sendMessageSchema } from "@/modules/conversation/validation";
import { handleIncomingMessage } from "@/modules/conversation/execution-pipeline";
import { createSseResponse } from "@/modules/conversation/transport/sse";
import { extractOriginHost } from "@/modules/widget/resolve-public-request";
import { isRateLimited } from "@/modules/widget/rate-limit";

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
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const originHost = extractOriginHost(request.headers);

  return createSseResponse(async (transport, signal) => {
    await handleIncomingMessage(parsed.data, originHost, transport, signal);
  }, request.signal);
}
