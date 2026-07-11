import { NextResponse, type NextRequest } from "next/server";
import { listConversationsQuerySchema } from "@/modules/conversation/validation";
import { listConversations } from "@/modules/conversation/inspector-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET(request: NextRequest) {
  const parsed = listConversationsQuerySchema.safeParse({
    widgetId: request.nextUrl.searchParams.get("widgetId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const conversations = await listConversations({ widgetId: parsed.data.widgetId });
    return NextResponse.json({ conversations });
  } catch (error) {
    return apiError(error);
  }
}
