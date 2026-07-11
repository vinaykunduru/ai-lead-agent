import "server-only";
import { eq } from "drizzle-orm";
import { type RlsDb, withRlsContext } from "@/db/client";
import { aiHandoffSettings, type AiHandoffSettings } from "@/db/schema";
import { requireCompanySession, type CompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import type { UpdateHandoffSettingsInput } from "./validation";

async function ensureHandoffSettings(tx: RlsDb, session: CompanySession): Promise<AiHandoffSettings> {
  const [existing] = await tx
    .select()
    .from(aiHandoffSettings)
    .where(eq(aiHandoffSettings.organizationId, session.organizationId))
    .limit(1);
  if (existing) return existing;

  const [created] = await tx
    .insert(aiHandoffSettings)
    .values({ organizationId: session.organizationId })
    .returning();
  return created;
}

export async function getHandoffSettings(): Promise<AiHandoffSettings> {
  const session = await requireCompanySession();
  assertPermission(session, "ai.view");

  return withRlsContext(session.userId, (tx) => ensureHandoffSettings(tx, session));
}

export async function updateHandoffSettings(
  input: UpdateHandoffSettingsInput,
): Promise<AiHandoffSettings> {
  const session = await requireCompanySession();
  assertPermission(session, "ai.update");

  const settings = await withRlsContext(session.userId, async (tx) => {
    await ensureHandoffSettings(tx, session);
    const [row] = await tx
      .update(aiHandoffSettings)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(aiHandoffSettings.organizationId, session.organizationId))
      .returning();
    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "ai_behaviour.handoff_updated",
    resourceType: "ai_handoff_settings",
    resourceId: settings.id,
    // escalationEmail/escalationMessage are excluded from metadata field
    // names too? No — field *names* only, never values, matches the
    // profile-service convention (CLAUDE.md §6: audit metadata must never
    // contain secrets or full content).
    metadata: { fields: Object.keys(input) },
  });

  return settings;
}
