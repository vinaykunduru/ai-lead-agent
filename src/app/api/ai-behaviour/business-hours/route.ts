import { NextResponse, type NextRequest } from "next/server";
import { updateBusinessHoursSchema } from "@/modules/ai-behaviour/validation";
import { getBusinessHours, updateBusinessHours } from "@/modules/ai-behaviour/business-hours-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET() {
  try {
    const businessHours = await getBusinessHours();
    return NextResponse.json({ businessHours });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = updateBusinessHoursSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const businessHours = await updateBusinessHours(parsed.data);
    return NextResponse.json({ businessHours });
  } catch (error) {
    return apiError(error);
  }
}
