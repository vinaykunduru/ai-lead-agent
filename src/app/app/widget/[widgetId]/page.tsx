import { getWidget } from "@/modules/widget/widgets-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { notFound } from "next/navigation";
import { GeneralForm } from "./general-form";

export default async function WidgetGeneralPage({
  params,
}: {
  params: Promise<{ widgetId: string }>;
}) {
  const { widgetId } = await params;
  const session = await requireCompanySession();
  const widget = await getWidget(widgetId);
  if (!widget) notFound();

  return (
    <div className="p-6">
      <GeneralForm
        widget={widget}
        canUpdate={can(session, "widget.update")}
        canPublish={can(session, "widget.publish")}
        canDelete={can(session, "widget.delete")}
      />
    </div>
  );
}
