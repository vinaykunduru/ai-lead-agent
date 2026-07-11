import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getPublicMessages } from "@/modules/conversation/public-messages";
import { extractOriginHost } from "@/modules/widget/resolve-public-request";
import { isRateLimited } from "@/modules/widget/rate-limit";

const querySchema = z.object({
  key: z.string().trim().min(1).max(200),
  after: z.string().datetime().optional(),
});
const paramsSchema = z.object({ conversationId: z.string().uuid() });

/**
 * Public, unauthenticated polling endpoint — see
 * modules/conversation/public-messages.ts's doc comment for why this
 * exists. The embed SDK calls this every few seconds while its panel is
 * open, passing `after` (the timestamp of the last message it already has)
 * to fetch only what's new.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const rateLimitKey = request.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { conversationId } = await params;
  const parsedParams = paramsSchema.safeParse({ conversationId });
  const parsedQuery = querySchema.safeParse({
    key: request.nextUrl.searchParams.get("key"),
    after: request.nextUrl.searchParams.get("after") ?? undefined,
  });
  if (!parsedParams.success || !parsedQuery.success) {
    return NextResponse.json({ error: "Invalid widget configuration request" }, { status: 400 });
  }

  const originHost = extractOriginHost(request.headers);

  try {
    const messages = await getPublicMessages(
      parsedQuery.data.key,
      originHost,
      parsedParams.data.conversationId,
      parsedQuery.data.after,
    );
    const response = NextResponse.json({ messages });
    const originHeader = request.headers.get("origin");
    if (originHeader) {
      response.headers.set("Access-Control-Allow-Origin", originHeader);
      response.headers.set("Vary", "Origin");
    }
    return response;
  } catch {
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
