import { PageHeader } from "@/shared/components/page-header";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { listWidgets } from "@/modules/widget/widgets-service";
import { WidgetsTable } from "./widgets-table";

export default async function WidgetListPage() {
  const session = await requireCompanySession();
  const widgets = await listWidgets();

  const permissions = {
    canCreate: can(session, "widget.create"),
    canUpdate: can(session, "widget.update"),
    canDelete: can(session, "widget.delete"),
    canPublish: can(session, "widget.publish"),
  };

  return (
    <div>
      <PageHeader title="Widget" description="Create and embed AI widgets on your website." />
      <div className="p-6">
        <WidgetsTable widgets={widgets} {...permissions} />
      </div>
    </div>
  );
}
