import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rotateWidgetKey } from "@/modules/widget/keys-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function POST(_request: NextRequest, { params }: { params: Promise<{ widgetId: string }> }) {
  const { widgetId } = await params;
  if (!uuidSchema.safeParse(widgetId).success) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  try {
    const key = await rotateWidgetKey(widgetId);
    return NextResponse.json({ key });
  } catch (error) {
    return apiError(error);
  }
}
