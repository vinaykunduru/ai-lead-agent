import { listWidgetKeys } from "@/modules/widget/keys-service";
import { generateInstallationSnippet } from "@/modules/widget/installation-snippet";
import { publicEnv } from "@/lib/env.public";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InstallationSnippet } from "./installation-snippet";

export default async function WidgetInstallationPage({
  params,
}: {
  params: Promise<{ widgetId: string }>;
}) {
  const { widgetId } = await params;
  const keys = await listWidgetKeys(widgetId);
  const activeKey = keys.find((k) => k.status === "active");

  return (
    <div className="max-w-2xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Installation</CardTitle>
          <p className="text-sm text-muted-foreground">
            Paste this snippet before the closing <code>&lt;/body&gt;</code> tag of your site. It only
            exposes a public key — never your account, organization, or knowledge base.
          </p>
        </CardHeader>
        <CardContent>
          {activeKey ? (
            <InstallationSnippet
              snippet={generateInstallationSnippet(activeKey.publicKey, publicEnv.NEXT_PUBLIC_APP_URL)}
            />
          ) : (
            <p className="text-sm text-destructive">
              This widget has no active key. Rotate a key on the Keys tab first.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
