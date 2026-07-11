import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { updateWidgetSchema } from "@/modules/widget/validation";
import {
  archiveWidget,
  getWidget,
  setWidgetStatus,
  updateWidget,
} from "@/modules/widget/widgets-service";
import { listWidgetKeys } from "@/modules/widget/keys-service";
import { listWidgetDomains } from "@/modules/widget/domains-service";
import { getWidgetTheme } from "@/modules/widget/theme-service";
import { getWidgetSettings } from "@/modules/widget/settings-service";
import { apiError } from "@/app/api/_lib/handle-error";

const uuidSchema = z.string().uuid();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ widgetId: string }> }) {
  const { widgetId } = await params;
  if (!uuidSchema.safeParse(widgetId).success) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  try {
    const widget = await getWidget(widgetId);
    if (!widget) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    }
    const [keys, domains, theme, settings] = await Promise.all([
      listWidgetKeys(widgetId),
      listWidgetDomains(widgetId),
      getWidgetTheme(widgetId),
      getWidgetSettings(widgetId),
    ]);
    return NextResponse.json({ widget, keys, domains, theme, settings });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ widgetId: string }> }) {
  const { widgetId } = await params;
  if (!uuidSchema.safeParse(widgetId).success) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateWidgetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { status, ...fields } = parsed.data;

  try {
    let widget = null;
    if (Object.keys(fields).length > 0) {
      widget = await updateWidget(widgetId, fields);
    }
    if (status !== undefined) {
      widget = await setWidgetStatus(widgetId, status);
    }
    if (!widget) {
      widget = await getWidget(widgetId);
      if (!widget) {
        return NextResponse.json({ error: "Widget not found" }, { status: 404 });
      }
    }
    return NextResponse.json({ widget });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ widgetId: string }> }) {
  const { widgetId } = await params;
  if (!uuidSchema.safeParse(widgetId).success) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  try {
    await archiveWidget(widgetId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
