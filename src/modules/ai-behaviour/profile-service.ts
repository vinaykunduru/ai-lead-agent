import "server-only";
import { eq } from "drizzle-orm";
import { type RlsDb, withRlsContext } from "@/db/client";
import { aiProfiles, type AiProfile } from "@/db/schema";
import { requireCompanySession, type CompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import type { UpdateAiProfileInput } from "./validation";

/**
 * Every organization gets an AI profile with sensible defaults the first
 * time it's touched — same lazy-creation pattern as
 * modules/knowledge/collections-service.ts's default collection, for the
 * same reason (CLAUDE.md's decoupled-modules rule: no trigger or FK from
 * organizations into this table).
 */
async function ensureProfile(tx: RlsDb, session: CompanySession): Promise<AiProfile> {
  const [existing] = await tx
    .select()
    .from(aiProfiles)
    .where(eq(aiProfiles.organizationId, session.organizationId))
    .limit(1);
  if (existing) return existing;

  const [created] = await tx
    .insert(aiProfiles)
    .values({ organizationId: session.organizationId })
    .returning();
  return created;
}

export async function getAiProfile(): Promise<AiProfile> {
  const session = await requireCompanySession();
  assertPermission(session, "ai.view");

  return withRlsContext(session.userId, (tx) => ensureProfile(tx, session));
}

export async function updateAiProfile(input: UpdateAiProfileInput): Promise<AiProfile> {
  const session = await requireCompanySession();
  assertPermission(session, "ai.update");

  const profile = await withRlsContext(session.userId, async (tx) => {
    await ensureProfile(tx, session);
    const [row] = await tx
      .update(aiProfiles)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(aiProfiles.organizationId, session.organizationId))
      .returning();
    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "ai_behaviour.profile_updated",
    resourceType: "ai_profile",
    resourceId: profile.id,
    // Field names only — never the configured text itself (assistant
    // description, company summary, etc. are company-authored content).
    metadata: { fields: Object.keys(input) },
  });

  return profile;
}
