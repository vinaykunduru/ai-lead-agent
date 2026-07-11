import "server-only";
import { and, asc, eq, notInArray } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { aiBusinessRules, type AiBusinessRule } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import type { UpdateBusinessRulesInput } from "./validation";

export async function listBusinessRules(): Promise<AiBusinessRule[]> {
  const session = await requireCompanySession();
  assertPermission(session, "ai.view");

  return withRlsContext(session.userId, (tx) =>
    tx
      .select()
      .from(aiBusinessRules)
      .where(eq(aiBusinessRules.organizationId, session.organizationId))
      .orderBy(asc(aiBusinessRules.sortOrder)),
  );
}

/**
 * Replaces the company's whole rule list in one call — matches the API
 * spec ("PATCH Business Rules"), not per-row create/delete endpoints. Rows
 * present in the incoming list (by id) are updated in place; rows missing
 * from it are deleted; rows without an id are inserted. `sortOrder` always
 * follows array position, so drag-to-reorder in the UI is just "send the
 * whole list back in the new order."
 */
export async function updateBusinessRules(input: UpdateBusinessRulesInput): Promise<AiBusinessRule[]> {
  const session = await requireCompanySession();
  assertPermission(session, "ai.update");

  const rules = await withRlsContext(session.userId, async (tx) => {
    const incomingIds = input.rules.map((r) => r.id).filter((id): id is string => Boolean(id));

    if (incomingIds.length > 0) {
      await tx
        .delete(aiBusinessRules)
        .where(
          and(
            eq(aiBusinessRules.organizationId, session.organizationId),
            notInArray(aiBusinessRules.id, incomingIds),
          ),
        );
    } else {
      await tx.delete(aiBusinessRules).where(eq(aiBusinessRules.organizationId, session.organizationId));
    }

    const result: AiBusinessRule[] = [];
    for (const [index, rule] of input.rules.entries()) {
      if (rule.id) {
        const [updated] = await tx
          .update(aiBusinessRules)
          .set({ text: rule.text, isEnabled: rule.isEnabled, sortOrder: index, updatedAt: new Date() })
          .where(
            and(eq(aiBusinessRules.id, rule.id), eq(aiBusinessRules.organizationId, session.organizationId)),
          )
          .returning();
        if (updated) result.push(updated);
      } else {
        const [created] = await tx
          .insert(aiBusinessRules)
          .values({
            organizationId: session.organizationId,
            text: rule.text,
            isEnabled: rule.isEnabled,
            sortOrder: index,
          })
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
    action: "ai_behaviour.business_rules_updated",
    resourceType: "ai_business_rules",
    metadata: { count: rules.length },
  });

  return rules.sort((a, b) => a.sortOrder - b.sortOrder);
}
