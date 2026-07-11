import { notFound } from "next/navigation";
import { getWidgetTheme } from "@/modules/widget/theme-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { AppearanceForm } from "./appearance-form";

export default async function WidgetAppearancePage({
  params,
}: {
  params: Promise<{ widgetId: string }>;
}) {
  const { widgetId } = await params;
  const session = await requireCompanySession();
  const theme = await getWidgetTheme(widgetId).catch(() => null);
  if (!theme) notFound();

  return (
    <div className="p-6">
      <AppearanceForm widgetId={widgetId} theme={theme} canUpdate={can(session, "widget.update")} />
    </div>
  );
}
