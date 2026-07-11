import { NextResponse, type NextRequest } from "next/server";
import { createAlertRuleSchema } from "@/modules/analytics/validation";
import { createAlertRule, evaluateAlerts } from "@/modules/analytics/alerts-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET() {
  try {
    const rules = await evaluateAlerts();
    return NextResponse.json({ rules });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createAlertRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const rule = await createAlertRule(parsed.data);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
