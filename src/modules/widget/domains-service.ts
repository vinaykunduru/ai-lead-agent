import "server-only";
import { and, asc, eq, notInArray } from "drizzle-orm";
import { withRlsContext } from "@/db/client";
import { widgetDomains, type WidgetDomain } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { assertWidgetBelongsToOrg } from "./shared";
import type { UpdateDomainsInput } from "./validation";

export async function listWidgetDomains(widgetId: string): Promise<WidgetDomain[]> {
  const session = await requireCompanySession();
  assertPermission(session, "widget.view");

  return withRlsContext(session.userId, async (tx) => {
    await assertWidgetBelongsToOrg(tx, widgetId, session.organizationId);
    return tx
      .select()
      .from(widgetDomains)
      .where(
        and(eq(widgetDomains.widgetId, widgetId), eq(widgetDomains.organizationId, session.organizationId)),
      )
      .orderBy(asc(widgetDomains.domain));
  });
}

/**
 * Replaces a widget's whole allowed-domain list in one call — same
 * "PATCH replaces the list" shape as modules/ai-behaviour's
 * business-rules-service.ts, for the same reason (matches the module
 * spec's "PATCH Domains" endpoint, not per-row create/delete endpoints).
 * Individually audits added and removed domains, since "Domain Added" /
 * "Domain Removed" are distinct required audit actions (unlike business
 * rules, which only audits the update as a whole).
 */
export async function updateWidgetDomains(
  widgetId: string,
  input: UpdateDomainsInput,
): Promise<WidgetDomain[]> {
  const session = await requireCompanySession();
  assertPermission(session, "widget.update");

  const { domains, removed, added } = await withRlsContext(session.userId, async (tx) => {
    await assertWidgetBelongsToOrg(tx, widgetId, session.organizationId);

    const existing = await tx
      .select()
      .from(widgetDomains)
      .where(
        and(eq(widgetDomains.widgetId, widgetId), eq(widgetDomains.organizationId, session.organizationId)),
      );

    const incomingIds = input.domains.map((d) => d.id).filter((id): id is string => Boolean(id));
    const removedRows = existing.filter((row) => !incomingIds.includes(row.id));

    if (incomingIds.length > 0) {
      await tx
        .delete(widgetDomains)
        .where(
          and(
            eq(widgetDomains.widgetId, widgetId),
            eq(widgetDomains.organizationId, session.organizationId),
            notInArray(widgetDomains.id, incomingIds),
          ),
        );
    } else {
      await tx
        .delete(widgetDomains)
        .where(
          and(eq(widgetDomains.widgetId, widgetId), eq(widgetDomains.organizationId, session.organizationId)),
        );
    }

    const result: WidgetDomain[] = [];
    const addedRows: WidgetDomain[] = [];
    for (const entry of input.domains) {
      if (entry.id) {
        const [updated] = await tx
          .update(widgetDomains)
          .set({ domain: entry.domain, isEnabled: entry.isEnabled, updatedAt: new Date() })
          .where(
            and(eq(widgetDomains.id, entry.id), eq(widgetDomains.organizationId, session.organizationId)),
          )
          .returning();
        if (updated) result.push(updated);
      } else {
        const [created] = await tx
          .insert(widgetDomains)
          .values({
            organizationId: session.organizationId,
            widgetId,
            domain: entry.domain,
            isEnabled: entry.isEnabled,
          })
          .returning();
        result.push(created);
        addedRows.push(created);
      }
    }

    return { domains: result, removed: removedRows, added: addedRows };
  });

  for (const removedDomain of removed) {
    await recordAuditLog({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorType: "company_user",
      action: "widget.domain_removed",
      resourceType: "widget",
      resourceId: widgetId,
      metadata: { domain: removedDomain.domain },
    });
  }

  for (const addedDomain of added) {
    await recordAuditLog({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorType: "company_user",
      action: "widget.domain_added",
      resourceType: "widget",
      resourceId: widgetId,
      metadata: { domain: addedDomain.domain },
    });
  }

  return domains.sort((a, b) => a.domain.localeCompare(b.domain));
}
