import "server-only";
import { and, eq } from "drizzle-orm";
import { type RlsDb, withRlsContext } from "@/db/client";
import { widgetSettings, type WidgetSettings } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { assertWidgetBelongsToOrg } from "./shared";
import type { UpdateBehaviourInput } from "./validation";

/** Every widget gets a settings row at creation time (widgets-service.ts),
 * so this only exists to defend against a row that somehow wasn't created. */
async function ensureSettings(
  tx: RlsDb,
  organizationId: string,
  widgetId: string,
): Promise<WidgetSettings> {
  const [existing] = await tx
    .select()
    .from(widgetSettings)
    .where(and(eq(widgetSettings.widgetId, widgetId), eq(widgetSettings.organizationId, organizationId)))
    .limit(1);
  if (existing) return existing;

  const [created] = await tx.insert(widgetSettings).values({ organizationId, widgetId }).returning();
  return created;
}

export async function getWidgetSettings(widgetId: string): Promise<WidgetSettings> {
  const session = await requireCompanySession();
  assertPermission(session, "widget.view");

  return withRlsContext(session.userId, async (tx) => {
    await assertWidgetBelongsToOrg(tx, widgetId, session.organizationId);
    return ensureSettings(tx, session.organizationId, widgetId);
  });
}

export async function updateWidgetSettings(
  widgetId: string,
  input: UpdateBehaviourInput,
): Promise<WidgetSettings> {
  const session = await requireCompanySession();
  assertPermission(session, "widget.update");

  const settings = await withRlsContext(session.userId, async (tx) => {
    await assertWidgetBelongsToOrg(tx, widgetId, session.organizationId);
    await ensureSettings(tx, session.organizationId, widgetId);
    const [row] = await tx
      .update(widgetSettings)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(eq(widgetSettings.widgetId, widgetId), eq(widgetSettings.organizationId, session.organizationId)),
      )
      .returning();
    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "widget.settings_updated",
    resourceType: "widget",
    resourceId: widgetId,
    metadata: { fields: Object.keys(input) },
  });

  return settings;
}
