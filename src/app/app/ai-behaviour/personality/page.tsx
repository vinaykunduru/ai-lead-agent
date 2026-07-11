import { getAiProfile } from "@/modules/ai-behaviour/profile-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { PersonalityForm } from "./personality-form";

export default async function PersonalityPage() {
  const session = await requireCompanySession();
  const profile = await getAiProfile();
  const canUpdate = can(session, "ai.update");

  return (
    <div className="p-6">
      <PersonalityForm profile={profile} canUpdate={canUpdate} />
    </div>
  );
}
