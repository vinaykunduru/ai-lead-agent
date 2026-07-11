import { listWidgetDomains } from "@/modules/widget/domains-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { DomainsForm } from "./domains-form";

export default async function WidgetDomainsPage({
  params,
}: {
  params: Promise<{ widgetId: string }>;
}) {
  const { widgetId } = await params;
  const session = await requireCompanySession();
  const domains = await listWidgetDomains(widgetId);

  return (
    <div className="p-6">
      <DomainsForm widgetId={widgetId} initialDomains={domains} canUpdate={can(session, "widget.update")} />
    </div>
  );
}
