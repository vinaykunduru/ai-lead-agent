import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { widgetDomains, widgetKeys, widgets, type Widget } from "@/db/schema";

/**
 * Generic, indistinguishable failure for every rejection reason (unknown
 * key, wrong format, revoked key, disabled/draft/archived widget,
 * disallowed origin) — CLAUDE.md §4: "never leak whether a key format is
 * 'close' to valid, and never leak which organization a key would have
 * resolved to." Callers must not pattern-match on this message to
 * distinguish cases; the whole point is that they can't.
 */
export const INVALID_WIDGET_ERROR = "Invalid widget configuration request";

/**
 * Resolves `publicKey → widget_keys → widgets`, validating the key is
 * active, the widget is active, and (if the widget has any allowed domains
 * configured) the request's origin matches one — the "Resolve Widget →
 * Validate Public Key → Validate Allowed Domain" steps every public widget
 * entry point needs (module spec §8/§14), extracted here so
 * modules/widget/public-config-service.ts and
 * modules/conversation/execution-pipeline.ts share exactly one
 * implementation rather than two copies that could drift.
 *
 * Returns the FULL internal `widgets` row, including `organizationId` —
 * this is for server-side use only by other service-role-authorized
 * callers. Never return this row (or any field derived from it beyond what
 * a specific public-safe DTO explicitly allow-lists) directly to a client.
 *
 * Uses the service-role client because no visitor session exists — one of
 * the four documented CLAUDE.md §3.6 exceptions — and manually re-scopes
 * every query, since RLS provides no protection on this path.
 */
export async function resolveWidgetForPublicRequest(
  publicKey: string,
  originHostname: string | null,
): Promise<Widget> {
  const [keyRow] = await db
    .select({ widgetId: widgetKeys.widgetId })
    .from(widgetKeys)
    .where(and(eq(widgetKeys.publicKey, publicKey), eq(widgetKeys.status, "active")))
    .limit(1);
  if (!keyRow) {
    throw new Error(INVALID_WIDGET_ERROR);
  }

  const [widget] = await db
    .select()
    .from(widgets)
    .where(and(eq(widgets.id, keyRow.widgetId), eq(widgets.status, "active")))
    .limit(1);
  if (!widget) {
    throw new Error(INVALID_WIDGET_ERROR);
  }

  const allowedDomains = await db
    .select({ domain: widgetDomains.domain, isEnabled: widgetDomains.isEnabled })
    .from(widgetDomains)
    .where(eq(widgetDomains.widgetId, widget.id));

  // Domain enforcement is opt-in: a widget with zero configured domains is
  // not yet restricted (every competitor widget platform behaves this way
  // — a freshly created widget must be embeddable before its owner has had
  // a chance to add an allowlist entry). The moment at least one domain is
  // added for a widget, only matching, enabled domains are accepted.
  if (allowedDomains.length > 0) {
    const isAllowed =
      originHostname !== null &&
      allowedDomains.some((d) => d.isEnabled && d.domain === originHostname);
    if (!isAllowed) {
      throw new Error(INVALID_WIDGET_ERROR);
    }
  }

  return widget;
}

/**
 * Extracts and normalizes the caller's origin hostname (including port,
 * e.g. "localhost:3000") from the Origin header, falling back to Referer —
 * shared by every public widget entry point that needs to validate against
 * modules/widget's allowed-domains list. Returns null if neither header is
 * present or parseable, which resolveWidgetForPublicRequest treats as "no
 * origin" (rejected only if the widget has domains configured).
 */
export function extractOriginHost(headers: { get(name: string): string | null }): string | null {
  const originHeader = headers.get("origin") ?? headers.get("referer");
  if (!originHeader) return null;
  try {
    return new URL(originHeader).host.toLowerCase();
  } catch {
    return null;
  }
}
