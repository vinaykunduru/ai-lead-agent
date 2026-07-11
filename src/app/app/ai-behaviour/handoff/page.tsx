import { getHandoffSettings } from "@/modules/ai-behaviour/handoff-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { HandoffForm } from "./handoff-form";

export default async function HandoffPage() {
  const session = await requireCompanySession();
  const handoff = await getHandoffSettings();
  const canUpdate = can(session, "ai.update");

  return (
    <div className="p-6">
      <HandoffForm handoff={handoff} canUpdate={canUpdate} />
    </div>
  );
}
