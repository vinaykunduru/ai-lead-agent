import { listBusinessRules } from "@/modules/ai-behaviour/business-rules-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { BusinessRulesForm } from "./business-rules-form";

export default async function BusinessRulesPage() {
  const session = await requireCompanySession();
  const rules = await listBusinessRules();
  const canUpdate = can(session, "ai.update");

  return (
    <div className="p-6">
      <BusinessRulesForm initialRules={rules} canUpdate={canUpdate} />
    </div>
  );
}
