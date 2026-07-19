import Link from "next/link";
import { Radio, TriangleAlert } from "lucide-react";
import { listWidgetKeys } from "@/modules/widget/keys-service";
import { listWidgetDomains } from "@/modules/widget/domains-service";
import { listConversations } from "@/modules/conversation/inspector-service";
import { generateInstallationSnippet } from "@/modules/widget/installation-snippet";
import { publicEnv } from "@/lib/env.public";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InstallationSnippet } from "./installation-snippet";

export default async function WidgetInstallationPage({
  params,
}: {
  params: Promise<{ widgetId: string }>;
}) {
  const { widgetId } = await params;
  const session = await requireCompanySession();
  const canViewConversations = can(session, "conversations.view");

  const [keys, domains, conversations] = await Promise.all([
    listWidgetKeys(widgetId),
    listWidgetDomains(widgetId),
    canViewConversations ? listConversations({ widgetId }) : Promise.resolve([]),
  ]);
  const activeKey = keys.find((k) => k.status === "active");
  const hasAllowedDomain = domains.some((d) => d.isEnabled);
  const hasTraffic = conversations.length > 0;

  return (
    <div className="max-w-2xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Install on your website</CardTitle>
          <p className="text-sm text-muted-foreground">
            Two lines of code, no server changes required. The snippet only exposes a public key — never
            your account, organization, or knowledge base.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!activeKey ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-dashed p-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                This widget has no active key yet. Rotate a key on the{" "}
                <Link href={`/app/widget/${widgetId}/keys`} className="font-medium text-primary hover:underline">
                  Keys tab
                </Link>{" "}
                first, then come back here.
              </p>
            </div>
          ) : (
            <>
              {!hasAllowedDomain ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-dashed p-3">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    You haven&rsquo;t allowed a domain yet — the widget will refuse to load anywhere until
                    you do. Add your site on the{" "}
                    <Link href={`/app/widget/${widgetId}/domains`} className="font-medium text-primary hover:underline">
                      Domains tab
                    </Link>
                    .
                  </p>
                </div>
              ) : null}

              <ol className="space-y-3 text-sm">
                <li className="flex gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    1
                  </span>
                  <span className="pt-0.5">Copy the snippet below.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    2
                  </span>
                  <span className="pt-0.5">
                    Paste it just before the closing <code>&lt;/body&gt;</code> tag on every page you want
                    the chat widget to appear.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    3
                  </span>
                  <span className="pt-0.5">
                    Publish the widget from the{" "}
                    <Link href={`/app/widget/${widgetId}`} className="font-medium text-primary hover:underline">
                      General tab
                    </Link>{" "}
                    if you haven&rsquo;t already, then visit your site to try it yourself.
                  </span>
                </li>
              </ol>

              <InstallationSnippet
                snippet={generateInstallationSnippet(activeKey.publicKey, publicEnv.NEXT_PUBLIC_APP_URL)}
              />
            </>
          )}
        </CardContent>
      </Card>

      {activeKey && canViewConversations ? (
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Radio
              className={hasTraffic ? "size-4 shrink-0 text-success" : "size-4 shrink-0 text-muted-foreground"}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {hasTraffic ? "Live — this widget has received real conversations" : "Waiting for its first visitor"}
              </p>
              <p className="text-caption text-muted-foreground">
                {hasTraffic
                  ? "Your install snippet is working."
                  : "This updates automatically once someone opens the chat on your site."}
              </p>
            </div>
            {hasTraffic ? (
              <Button variant="outline" size="sm" render={<Link href="/app/conversations">View conversations</Link>} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
