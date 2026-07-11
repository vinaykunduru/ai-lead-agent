import { listWidgetKeys } from "@/modules/widget/keys-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { KeysPanel } from "./keys-panel";

export default async function WidgetKeysPage({
  params,
}: {
  params: Promise<{ widgetId: string }>;
}) {
  const { widgetId } = await params;
  const session = await requireCompanySession();
  const keys = await listWidgetKeys(widgetId);

  return (
    <div className="p-6">
      <KeysPanel widgetId={widgetId} keys={keys} canRotate={can(session, "widget.update")} />
    </div>
  );
}
