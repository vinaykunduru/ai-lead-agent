import { NextResponse, type NextRequest } from "next/server";
import { updateAiProfileSchema } from "@/modules/ai-behaviour/validation";
import { getAiProfile, updateAiProfile } from "@/modules/ai-behaviour/profile-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET() {
  try {
    const profile = await getAiProfile();
    return NextResponse.json({ profile });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = updateAiProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const profile = await updateAiProfile(parsed.data);
    return NextResponse.json({ profile });
  } catch (error) {
    return apiError(error);
  }
}
