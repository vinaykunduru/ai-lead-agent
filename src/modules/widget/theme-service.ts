import "server-only";
import { and, eq } from "drizzle-orm";
import { type RlsDb, withRlsContext } from "@/db/client";
import { widgetThemes, type WidgetTheme } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { assertWidgetBelongsToOrg } from "./shared";
import type { UpdateAppearanceInput } from "./validation";

/** Every widget gets a theme row at creation time (widgets-service.ts), so
 * this only exists to defend against a row that somehow wasn't created. */
async function ensureTheme(tx: RlsDb, organizationId: string, widgetId: string): Promise<WidgetTheme> {
  const [existing] = await tx
    .select()
    .from(widgetThemes)
    .where(and(eq(widgetThemes.widgetId, widgetId), eq(widgetThemes.organizationId, organizationId)))
    .limit(1);
  if (existing) return existing;

  const [created] = await tx.insert(widgetThemes).values({ organizationId, widgetId }).returning();
  return created;
}

export async function getWidgetTheme(widgetId: string): Promise<WidgetTheme> {
  const session = await requireCompanySession();
  assertPermission(session, "widget.view");

  return withRlsContext(session.userId, async (tx) => {
    await assertWidgetBelongsToOrg(tx, widgetId, session.organizationId);
    return ensureTheme(tx, session.organizationId, widgetId);
  });
}

export async function updateWidgetTheme(
  widgetId: string,
  input: UpdateAppearanceInput,
): Promise<WidgetTheme> {
  const session = await requireCompanySession();
  assertPermission(session, "widget.update");

  // A blank text input submits "" to mean "clear this field" — normalize to
  // null so the nullable URL columns don't end up storing an empty string.
  // Done here (plain runtime code), not in the Zod schema, since the schema
  // is also used with react-hook-form's zodResolver and CLAUDE.md's zod pin
  // note says to avoid `.transform()` there.
  const patch = { ...input };
  if (patch.logoUrl === "") patch.logoUrl = null;
  if (patch.avatarUrl === "") patch.avatarUrl = null;
  if (patch.launcherIcon === "") patch.launcherIcon = null;

  const theme = await withRlsContext(session.userId, async (tx) => {
    await assertWidgetBelongsToOrg(tx, widgetId, session.organizationId);
    await ensureTheme(tx, session.organizationId, widgetId);
    const [row] = await tx
      .update(widgetThemes)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(widgetThemes.widgetId, widgetId), eq(widgetThemes.organizationId, session.organizationId)))
      .returning();
    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "widget.theme_updated",
    resourceType: "widget",
    resourceId: widgetId,
    metadata: { fields: Object.keys(input) },
  });

  return theme;
}
