import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/shared/components/page-header";
import { BackLink } from "@/shared/components/back-link";
import { getWidget } from "@/modules/widget/widgets-service";
import { WidgetStatusBadge } from "../status-badges";
import { WidgetNav } from "./widget-nav";

export default async function WidgetDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ widgetId: string }>;
}) {
  const { widgetId } = await params;
  if (!z.string().uuid().safeParse(widgetId).success) {
    notFound();
  }

  const widget = await getWidget(widgetId);
  if (!widget) {
    notFound();
  }

  return (
    <div>
      <div className="border-b px-6 pt-5">
        <BackLink href="/app/widget" label="Widgets" />
      </div>
      <PageHeader
        title={widget.name}
        actions={<WidgetStatusBadge status={widget.status} />}
      />
      <WidgetNav widgetId={widgetId} />
      {children}
    </div>
  );
}
