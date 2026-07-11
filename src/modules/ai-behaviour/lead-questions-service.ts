import "server-only";
import { and, asc, eq, notInArray } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { aiLeadQuestions, type AiLeadQuestion } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import type { UpdateLeadQuestionsInput } from "./validation";

export async function listLeadQuestions(): Promise<AiLeadQuestion[]> {
  const session = await requireCompanySession();
  assertPermission(session, "ai.view");

  return withRlsContext(session.userId, (tx) =>
    tx
      .select()
      .from(aiLeadQuestions)
      .where(eq(aiLeadQuestions.organizationId, session.organizationId))
      .orderBy(asc(aiLeadQuestions.sortOrder)),
  );
}

/**
 * Replaces the company's whole qualification-question list in one call —
 * same "PATCH replaces the ordered list" shape as
 * business-rules-service.ts's updateBusinessRules, for the same reason.
 */
export async function updateLeadQuestions(input: UpdateLeadQuestionsInput): Promise<AiLeadQuestion[]> {
  const session = await requireCompanySession();
  assertPermission(session, "ai.update");

  const questions = await withRlsContext(session.userId, async (tx) => {
    const incomingIds = input.questions.map((q) => q.id).filter((id): id is string => Boolean(id));

    if (incomingIds.length > 0) {
      await tx
        .delete(aiLeadQuestions)
        .where(
          and(
            eq(aiLeadQuestions.organizationId, session.organizationId),
            notInArray(aiLeadQuestions.id, incomingIds),
          ),
        );
    } else {
      await tx.delete(aiLeadQuestions).where(eq(aiLeadQuestions.organizationId, session.organizationId));
    }

    const result: AiLeadQuestion[] = [];
    for (const [index, question] of input.questions.entries()) {
      const values = {
        fieldKey: question.fieldKey,
        label: question.label,
        isRequired: question.isRequired,
        placeholder: question.placeholder ?? null,
        validationType: question.validationType,
        sortOrder: index,
      };
      if (question.id) {
        const [updated] = await tx
          .update(aiLeadQuestions)
          .set({ ...values, updatedAt: new Date() })
          .where(
            and(
              eq(aiLeadQuestions.id, question.id),
              eq(aiLeadQuestions.organizationId, session.organizationId),
            ),
          )
          .returning();
        if (updated) result.push(updated);
      } else {
        const [created] = await tx
          .insert(aiLeadQuestions)
          .values({ organizationId: session.organizationId, ...values })
          .returning();
        result.push(created);
      }
    }
    return result;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "ai_behaviour.lead_questions_updated",
    resourceType: "ai_lead_questions",
    metadata: { count: questions.length },
  });

  return questions.sort((a, b) => a.sortOrder - b.sortOrder);
}
