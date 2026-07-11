import { NextResponse, type NextRequest } from "next/server";
import { inboxQuerySchema } from "@/modules/leads/validation";
import { listInboxConversations } from "@/modules/inbox/inbox-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET(request: NextRequest) {
  const parsed = inboxQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const conversations = await listInboxConversations(parsed.data);
    return NextResponse.json({ conversations });
  } catch (error) {
    return apiError(error);
  }
}
