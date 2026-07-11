import { getBusinessHours } from "@/modules/ai-behaviour/business-hours-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { BusinessHoursForm } from "./business-hours-form";

export default async function BusinessHoursPage() {
  const session = await requireCompanySession();
  const businessHours = await getBusinessHours();
  const canUpdate = can(session, "ai.update");

  return (
    <div className="p-6">
      <BusinessHoursForm businessHours={businessHours} canUpdate={canUpdate} />
    </div>
  );
}
