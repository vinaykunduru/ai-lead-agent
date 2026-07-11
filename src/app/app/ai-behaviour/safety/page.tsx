import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAiProfile } from "@/modules/ai-behaviour/profile-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { PLATFORM_SAFETY_GUARDRAILS } from "@/modules/ai-behaviour/prompt-generator";
import { SafetyForm } from "./safety-form";

export default async function SafetyPage() {
  const session = await requireCompanySession();
  const profile = await getAiProfile();
  const canUpdate = can(session, "ai.update");

  return (
    <div className="max-w-2xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Platform guardrails</CardTitle>
          <p className="text-sm text-muted-foreground">
            Always active for every company. These cannot be disabled or overridden by configuration.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {PLATFORM_SAFETY_GUARDRAILS.map((rule) => (
              <li key={rule} className="flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <SafetyForm profile={profile} canUpdate={canUpdate} />
    </div>
  );
}
