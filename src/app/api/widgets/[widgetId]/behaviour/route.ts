import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { updateBehaviourSchema } from "@/modules/widget/validation";
import { updateWidgetSettings } from "@/modules/widget/settings-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ widgetId: string }> }) {
  const { widgetId } = await params;
  if (!uuidSchema.safeParse(widgetId).success) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateBehaviourSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const settings = await updateWidgetSettings(widgetId, parsed.data);
    return NextResponse.json({ settings });
  } catch (error) {
    return apiError(error);
  }
}
