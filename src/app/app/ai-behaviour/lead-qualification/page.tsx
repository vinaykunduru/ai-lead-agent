import { listLeadQuestions } from "@/modules/ai-behaviour/lead-questions-service";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { LeadQuestionsForm } from "./lead-questions-form";

export default async function LeadQualificationPage() {
  const session = await requireCompanySession();
  const questions = await listLeadQuestions();
  const canUpdate = can(session, "ai.update");

  return (
    <div className="p-6">
      <LeadQuestionsForm initialQuestions={questions} canUpdate={canUpdate} />
    </div>
  );
}
