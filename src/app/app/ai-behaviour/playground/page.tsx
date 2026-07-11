import { getAiProfile } from "@/modules/ai-behaviour/profile-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { PlaygroundForm } from "./playground-form";

export default async function PlaygroundPage() {
  const session = await requireCompanySession();
  const profile = await getAiProfile();
  const canTest = can(session, "ai.test");

  return (
    <div className="p-6">
      <PlaygroundForm profile={profile} canTest={canTest} />
    </div>
  );
}
