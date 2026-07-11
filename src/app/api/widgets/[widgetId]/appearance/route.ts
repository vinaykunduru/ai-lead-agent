import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { updateAppearanceSchema } from "@/modules/widget/validation";
import { updateWidgetTheme } from "@/modules/widget/theme-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ widgetId: string }> }) {
  const { widgetId } = await params;
  if (!uuidSchema.safeParse(widgetId).success) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateAppearanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const theme = await updateWidgetTheme(widgetId, parsed.data);
    return NextResponse.json({ theme });
  } catch (error) {
    return apiError(error);
  }
}
