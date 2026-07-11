import { getAiProfile } from "@/modules/ai-behaviour/profile-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { LanguageForm } from "./language-form";

export default async function LanguagePage() {
  const session = await requireCompanySession();
  const profile = await getAiProfile();
  const canUpdate = can(session, "ai.update");

  return (
    <div className="p-6">
      <LanguageForm profile={profile} canUpdate={canUpdate} />
    </div>
  );
}
