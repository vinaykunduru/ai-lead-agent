import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { updateDomainsSchema } from "@/modules/widget/validation";
import { updateWidgetDomains } from "@/modules/widget/domains-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ widgetId: string }> }) {
  const { widgetId } = await params;
  if (!uuidSchema.safeParse(widgetId).success) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateDomainsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const domains = await updateWidgetDomains(widgetId, parsed.data);
    return NextResponse.json({ domains });
  } catch (error) {
    return apiError(error);
  }
}
