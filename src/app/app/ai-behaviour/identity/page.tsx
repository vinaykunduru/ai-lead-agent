import { getAiProfile } from "@/modules/ai-behaviour/profile-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { IdentityForm } from "./identity-form";

export default async function IdentityPage() {
  const session = await requireCompanySession();
  const profile = await getAiProfile();
  const canUpdate = can(session, "ai.update");

  return (
    <div className="p-6">
      <IdentityForm profile={profile} canUpdate={canUpdate} />
    </div>
  );
}
