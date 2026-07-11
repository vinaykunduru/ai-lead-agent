import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { updateAlertRuleSchema } from "@/modules/analytics/validation";
import { deleteAlertRule, updateAlertRule } from "@/modules/analytics/alerts-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params;
  if (!uuidSchema.safeParse(ruleId).success) {
    return NextResponse.json({ error: "Alert rule not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateAlertRuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const rule = await updateAlertRule(ruleId, parsed.data);
    return NextResponse.json({ rule });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params;
  if (!uuidSchema.safeParse(ruleId).success) {
    return NextResponse.json({ error: "Alert rule not found" }, { status: 404 });
  }

  try {
    await deleteAlertRule(ruleId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
