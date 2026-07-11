import { NextResponse, type NextRequest } from "next/server";
import { analyticsFilterSchema } from "@/modules/analytics/validation";
import { getInboxAnalytics } from "@/modules/analytics/inbox-analytics-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET(request: NextRequest) {
  const parsed = analyticsFilterSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const analytics = await getInboxAnalytics(parsed.data);
    return NextResponse.json({ analytics });
  } catch (error) {
    return apiError(error);
  }
}
