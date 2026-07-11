import { NextResponse, type NextRequest } from "next/server";
import { updateHandoffSettingsSchema } from "@/modules/ai-behaviour/validation";
import { getHandoffSettings, updateHandoffSettings } from "@/modules/ai-behaviour/handoff-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET() {
  try {
    const handoff = await getHandoffSettings();
    return NextResponse.json({ handoff });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = updateHandoffSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const handoff = await updateHandoffSettings(parsed.data);
    return NextResponse.json({ handoff });
  } catch (error) {
    return apiError(error);
  }
}
