import { notFound } from "next/navigation";
import { Palette, MessageSquareText, Globe, Rocket, Radio } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ChecklistList, type ChecklistItem } from "@/shared/components/checklist-list";
import { getWidget } from "@/modules/widget/widgets-service";
import { getWidgetTheme } from "@/modules/widget/theme-service";
import { getWidgetSettings } from "@/modules/widget/settings-service";
import { listWidgetDomains } from "@/modules/widget/domains-service";
import { listConversations } from "@/modules/conversation/inspector-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { GeneralForm } from "./general-form";

export default async function WidgetGeneralPage({
  params,
}: {
  params: Promise<{ widgetId: string }>;
}) {
  const { widgetId } = await params;
  const session = await requireCompanySession();
  const canViewConversations = can(session, "conversations.view");

  const [widget, theme, settings, domains, conversations] = await Promise.all([
    getWidget(widgetId),
    getWidgetTheme(widgetId),
    getWidgetSettings(widgetId),
    listWidgetDomains(widgetId),
    canViewConversations ? listConversations({ widgetId }) : Promise.resolve([]),
  ]);
  if (!widget) notFound();

  const appearanceDone = theme.updatedAt.getTime() !== theme.createdAt.getTime();
  const behaviourDone = settings.updatedAt.getTime() !== settings.createdAt.getTime();
  const domainsDone = domains.some((d) => d.isEnabled);
  const publishedDone = widget.status === "active";
  const trafficDone = conversations.length > 0;

  const steps: ChecklistItem[] = [
    { id: "appearance", label: "Customize appearance", complete: appearanceDone, icon: Palette, href: `/app/widget/${widgetId}/appearance` },
    { id: "behaviour", label: "Set welcome message & behaviour", complete: behaviourDone, icon: MessageSquareText, href: `/app/widget/${widgetId}/behaviour` },
    { id: "domains", label: "Allow your website's domain", complete: domainsDone, icon: Globe, href: `/app/widget/${widgetId}/domains` },
    { id: "publish", label: "Publish the widget", complete: publishedDone, icon: Rocket },
    { id: "traffic", label: "Confirm it's receiving visitors", complete: trafficDone, icon: Radio, href: canViewConversations ? "/app/conversations" : undefined },
  ];

  const allDone = steps.every((step) => step.complete);

  return (
    <div className="max-w-2xl space-y-6 p-6">
      {!allDone ? (
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-sm font-semibold">Deploying this widget</h2>
            <p className="mt-1 text-caption text-muted-foreground">
              Five steps from a blank widget to real visitors chatting with your AI.
            </p>
            <ChecklistList items={steps} />
            {publishedDone && !trafficDone ? (
              <p className="mt-3 text-caption text-muted-foreground">
                Waiting for your first visitor — this updates automatically once someone opens the chat on
                your site.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <GeneralForm
        widget={widget}
        canUpdate={can(session, "widget.update")}
        canPublish={can(session, "widget.publish")}
        canDelete={can(session, "widget.delete")}
      />
    </div>
  );
}
