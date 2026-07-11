import "server-only";
import { and, eq } from "drizzle-orm";
import type { RlsDb } from "@/db/client";
import { widgets } from "@/db/schema";

/**
 * Shared by every widget-scoped service (keys, domains, theme, settings) —
 * kept in its own file rather than re-exported from widgets-service.ts to
 * avoid a circular import (widgets-service.ts itself depends on
 * keys-service.ts to provision a widget's first key at creation time).
 */
export async function assertWidgetBelongsToOrg(
  tx: RlsDb,
  widgetId: string,
  organizationId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: widgets.id })
    .from(widgets)
    .where(and(eq(widgets.id, widgetId), eq(widgets.organizationId, organizationId)))
    .limit(1);
  if (!row) {
    throw new Error("Widget not found");
  }
}
