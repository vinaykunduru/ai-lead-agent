import { notFound } from "next/navigation";
import { getWidgetSettings } from "@/modules/widget/settings-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { BehaviourForm } from "./behaviour-form";

export default async function WidgetBehaviourPage({
  params,
}: {
  params: Promise<{ widgetId: string }>;
}) {
  const { widgetId } = await params;
  const session = await requireCompanySession();
  const settings = await getWidgetSettings(widgetId).catch(() => null);
  if (!settings) notFound();

  return (
    <div className="p-6">
      <BehaviourForm widgetId={widgetId} settings={settings} canUpdate={can(session, "widget.update")} />
    </div>
  );
}
