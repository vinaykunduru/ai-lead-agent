import { NextResponse, type NextRequest } from "next/server";
import { createWidgetSchema } from "@/modules/widget/validation";
import { createWidget, listWidgets } from "@/modules/widget/widgets-service";
import { apiError } from "@/app/api/_lib/handle-error";

export async function GET() {
  try {
    const widgets = await listWidgets();
    return NextResponse.json({ widgets });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createWidgetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    const widget = await createWidget(parsed.data);
    return NextResponse.json({ widget }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
