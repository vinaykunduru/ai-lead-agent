import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { widgets, widgetSettings, widgetThemes, type Widget } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { createInitialKey } from "./keys-service";
import type { CreateWidgetInput, UpdateWidgetInput } from "./validation";

export { assertWidgetBelongsToOrg } from "./shared";

export async function listWidgets(): Promise<Widget[]> {
  const session = await requireCompanySession();
  assertPermission(session, "widget.view");

  return withRlsContext(session.userId, (tx) =>
    tx
      .select()
      .from(widgets)
      .where(eq(widgets.organizationId, session.organizationId))
      .orderBy(desc(widgets.createdAt)),
  );
}

export async function getWidget(widgetId: string): Promise<Widget | null> {
  const session = await requireCompanySession();
  assertPermission(session, "widget.view");

  return withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .select()
      .from(widgets)
      .where(and(eq(widgets.id, widgetId), eq(widgets.organizationId, session.organizationId)))
      .limit(1);
    return row ?? null;
  });
}

/**
 * Creates the widget plus its default theme, settings, and first public
 * key in one transaction — a widget is never left half-provisioned (e.g.
 * with no key to embed, or no theme row for the Appearance tab to edit).
 */
export async function createWidget(input: CreateWidgetInput): Promise<Widget> {
  const session = await requireCompanySession();
  assertPermission(session, "widget.create");

  const widget = await withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .insert(widgets)
      .values({
        organizationId: session.organizationId,
        name: input.name,
        description: input.description ?? null,
        defaultLanguage: input.defaultLanguage ?? "en",
        createdBy: session.userId,
      })
      .returning();

    await tx.insert(widgetThemes).values({ organizationId: session.organizationId, widgetId: row.id });
    await tx.insert(widgetSettings).values({ organizationId: session.organizationId, widgetId: row.id });
    await createInitialKey(tx, session, row.id);

    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "widget.created",
    resourceType: "widget",
    resourceId: widget.id,
    metadata: { name: widget.name },
  });

  return widget;
}

/** Ordinary content fields only — never status (see setWidgetStatus). */
export async function updateWidget(widgetId: string, input: UpdateWidgetInput): Promise<Widget> {
  const session = await requireCompanySession();
  const { status, ...fields } = input;
  if (status !== undefined) {
    throw new Error("Use setWidgetStatus to change a widget's status");
  }
  assertPermission(session, "widget.update");

  const widget = await withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .update(widgets)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(widgets.id, widgetId), eq(widgets.organizationId, session.organizationId)))
      .returning();
    return row;
  });

  if (!widget) {
    throw new Error("Widget not found");
  }

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "widget.updated",
    resourceType: "widget",
    resourceId: widget.id,
    metadata: { fields: Object.keys(fields) },
  });

  return widget;
}

/**
 * The only path that changes widget.status — gated by "widget.publish"
 * (going live, or taking a live widget down, is a more consequential
 * action than editing its name, so it gets its own permission bit).
 * 'active' logs as "enabled" and 'disabled' logs as "disabled" to match
 * the module spec's audit action names; other transitions (e.g. back to
 * 'draft') log as a generic update.
 */
export async function setWidgetStatus(widgetId: string, status: Widget["status"]): Promise<Widget> {
  const session = await requireCompanySession();
  assertPermission(session, "widget.publish");

  const widget = await withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .update(widgets)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(widgets.id, widgetId), eq(widgets.organizationId, session.organizationId)))
      .returning();
    return row;
  });

  if (!widget) {
    throw new Error("Widget not found");
  }

  const action = status === "active" ? "widget.enabled" : status === "disabled" ? "widget.disabled" : "widget.updated";
  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action,
    resourceType: "widget",
    resourceId: widget.id,
    metadata: { status },
  });

  return widget;
}

/** Soft delete only — sets status to 'archived', matching the
 * knowledge-base module's no-permanent-delete pattern. */
export async function archiveWidget(widgetId: string): Promise<void> {
  const session = await requireCompanySession();
  assertPermission(session, "widget.delete");

  const widget = await withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .update(widgets)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(widgets.id, widgetId), eq(widgets.organizationId, session.organizationId)))
      .returning();
    return row;
  });

  if (!widget) {
    throw new Error("Widget not found");
  }

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "widget.deleted",
    resourceType: "widget",
    resourceId: widgetId,
  });
}
