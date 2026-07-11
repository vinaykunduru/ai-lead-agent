import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getInboxConversation } from "@/modules/inbox/inbox-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  if (!uuidSchema.safeParse(conversationId).success) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  try {
    const detail = await getInboxConversation(conversationId);
    if (!detail.conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    return apiError(error);
  }
}
