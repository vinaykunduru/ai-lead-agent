import { NextResponse, type NextRequest } from "next/server";
import { updateDashboardPreferencesSchema } from "@/modules/analytics/validation";
import { getDashboardPreferences, updateDashboardPreferences } from "@/modules/analytics/dashboard-preferences-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET() {
  try {
    const cards = await getDashboardPreferences();
    return NextResponse.json({ cards });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = updateDashboardPreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const cards = await updateDashboardPreferences(parsed.data);
    return NextResponse.json({ cards });
  } catch (error) {
    return apiError(error);
  }
}
