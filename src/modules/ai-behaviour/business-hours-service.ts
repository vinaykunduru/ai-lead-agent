import "server-only";
import { eq } from "drizzle-orm";
import { type RlsDb, withRlsContext } from "@/db/client";
import { aiBusinessHours, organizations, type AiBusinessHours } from "@/db/schema";
import { requireCompanySession, type CompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import type { UpdateBusinessHoursInput } from "./validation";

async function ensureBusinessHours(tx: RlsDb, session: CompanySession): Promise<AiBusinessHours> {
  const [existing] = await tx
    .select()
    .from(aiBusinessHours)
    .where(eq(aiBusinessHours.organizationId, session.organizationId))
    .limit(1);
  if (existing) return existing;

  // Prefill from the organization's own timezone (set at signup) rather
  // than always defaulting to UTC — a small UX touch, not a new source of
  // truth (the column is still independently editable afterward).
  const [org] = await tx
    .select({ timezone: organizations.timezone })
    .from(organizations)
    .where(eq(organizations.id, session.organizationId))
    .limit(1);

  const [created] = await tx
    .insert(aiBusinessHours)
    .values({ organizationId: session.organizationId, timezone: org?.timezone ?? "UTC" })
    .returning();
  return created;
}

export async function getBusinessHours(): Promise<AiBusinessHours> {
  const session = await requireCompanySession();
  assertPermission(session, "ai.view");

  return withRlsContext(session.userId, (tx) => ensureBusinessHours(tx, session));
}

export async function updateBusinessHours(input: UpdateBusinessHoursInput): Promise<AiBusinessHours> {
  const session = await requireCompanySession();
  assertPermission(session, "ai.update");

  const hours = await withRlsContext(session.userId, async (tx) => {
    await ensureBusinessHours(tx, session);
    const [row] = await tx
      .update(aiBusinessHours)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(aiBusinessHours.organizationId, session.organizationId))
      .returning();
    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "ai_behaviour.business_hours_updated",
    resourceType: "ai_business_hours",
    resourceId: hours.id,
    metadata: { fields: Object.keys(input) },
  });

  return hours;
}
