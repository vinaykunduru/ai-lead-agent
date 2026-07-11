import { NextResponse, type NextRequest } from "next/server";
import { updateBusinessRulesSchema } from "@/modules/ai-behaviour/validation";
import { listBusinessRules, updateBusinessRules } from "@/modules/ai-behaviour/business-rules-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET() {
  try {
    const rules = await listBusinessRules();
    return NextResponse.json({ rules });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = updateBusinessRulesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const rules = await updateBusinessRules(parsed.data);
    return NextResponse.json({ rules });
  } catch (error) {
    return apiError(error);
  }
}
