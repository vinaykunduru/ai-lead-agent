import "server-only";
import { eq } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { dashboardPreferences } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { DASHBOARD_CARD_KEYS, type UpdateDashboardPreferencesInput } from "./validation";

export type DashboardCardPreference = { key: (typeof DASHBOARD_CARD_KEYS)[number]; visible: boolean; sortOrder: number };

const DEFAULT_CARDS: DashboardCardPreference[] = DASHBOARD_CARD_KEYS.map((key, index) => ({
  key,
  visible: true,
  sortOrder: index,
}));

/** "Allow companies to customize dashboard cards" (module spec §11) —
 * lazily defaulted the same way modules/leads' default stages are: no row
 * yet means "every card visible, in the module's default order." */
export async function getDashboardPreferences(): Promise<DashboardCardPreference[]> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  return withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .select()
      .from(dashboardPreferences)
      .where(eq(dashboardPreferences.organizationId, session.organizationId))
      .limit(1);
    return row ? (row.cards as DashboardCardPreference[]) : DEFAULT_CARDS;
  });
}

export async function updateDashboardPreferences(
  input: UpdateDashboardPreferencesInput,
): Promise<DashboardCardPreference[]> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  const cards = await withRlsContext(session.userId, async (tx) => {
    const [existing] = await tx
      .select({ id: dashboardPreferences.id })
      .from(dashboardPreferences)
      .where(eq(dashboardPreferences.organizationId, session.organizationId))
      .limit(1);

    if (existing) {
      const [updated] = await tx
        .update(dashboardPreferences)
        .set({ cards: input.cards, updatedAt: new Date() })
        .where(eq(dashboardPreferences.id, existing.id))
        .returning();
      return updated.cards as DashboardCardPreference[];
    }

    const [created] = await tx
      .insert(dashboardPreferences)
      .values({ organizationId: session.organizationId, cards: input.cards })
      .returning();
    return created.cards as DashboardCardPreference[];
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "analytics.dashboard_preferences_updated",
    resourceType: "dashboard_preferences",
    resourceId: session.organizationId,
  });

  return cards;
}
