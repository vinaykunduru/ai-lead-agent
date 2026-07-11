import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resumeAiConversation } from "@/modules/inbox/takeover-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;
  if (!uuidSchema.safeParse(conversationId).success) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  try {
    const conversation = await resumeAiConversation(conversationId);
    return NextResponse.json({ conversation });
  } catch (error) {
    return apiError(error);
  }
}
