import { NextResponse, type NextRequest } from "next/server";
import { updateLeadQuestionsSchema } from "@/modules/ai-behaviour/validation";
import { listLeadQuestions, updateLeadQuestions } from "@/modules/ai-behaviour/lead-questions-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET() {
  try {
    const questions = await listLeadQuestions();
    return NextResponse.json({ questions });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = updateLeadQuestionsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const questions = await updateLeadQuestions(parsed.data);
    return NextResponse.json({ questions });
  } catch (error) {
    return apiError(error);
  }
}
