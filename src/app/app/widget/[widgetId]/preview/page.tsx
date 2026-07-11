import { getWidget } from "@/modules/widget/widgets-service";
import { getWidgetTheme } from "@/modules/widget/theme-service";
import { getWidgetSettings } from "@/modules/widget/settings-service";
import { notFound } from "next/navigation";
import { WidgetPreview } from "./widget-preview";

export default async function WidgetPreviewPage({
  params,
}: {
  params: Promise<{ widgetId: string }>;
}) {
  const { widgetId } = await params;
  const widget = await getWidget(widgetId);
  if (!widget) notFound();

  const [theme, settings] = await Promise.all([getWidgetTheme(widgetId), getWidgetSettings(widgetId)]);

  return (
    <div className="p-6">
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Preview only — reflects your saved Appearance and Behaviour settings. It uses mocked content and
        never connects to an AI provider.
      </p>
      <WidgetPreview widget={widget} theme={theme} settings={settings} />
    </div>
  );
}
