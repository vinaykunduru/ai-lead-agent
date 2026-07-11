import "server-only";
import { eq } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { widgets } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";

export type WidgetFilterOption = { id: string; name: string };

/**
 * A minimal {id, name} list for the analytics filter bar's widget
 * dropdown — deliberately gated on `analytics.view`, not `widget.view`.
 * The "manager" role has analytics.view but not widget.view (it never
 * manages widgets), and knowing a widget's name to filter a report by
 * isn't the same capability as managing the widget itself, so reusing
 * modules/widget/widgets-service.ts's listWidgets() here would wrongly
 * block a manager from filtering their own analytics.
 */
export async function listWidgetsForAnalyticsFilter(): Promise<WidgetFilterOption[]> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  return withRlsContext(session.userId, (tx) =>
    tx
      .select({ id: widgets.id, name: widgets.name })
      .from(widgets)
      .where(eq(widgets.organizationId, session.organizationId)),
  );
}
