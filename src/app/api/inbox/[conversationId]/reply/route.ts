import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { replySchema } from "@/modules/leads/validation";
import { sendHumanReply } from "@/modules/inbox/reply-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function POST(request: NextRequest, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  if (!uuidSchema.safeParse(conversationId).success) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const message = await sendHumanReply(conversationId, parsed.data);
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
