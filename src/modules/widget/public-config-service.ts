import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { widgetDomains, widgetKeys, widgetSettings, widgetThemes, widgets } from "@/db/schema";

/**
 * Public-safe shape only — see CLAUDE.md §4: never organization id, widget
 * id, knowledge base, AI behaviour configuration, embeddings, or any
 * secret. This is the entire contract the embed SDK is allowed to see.
 */
export type PublicWidgetConfig = {
  name: string;
  defaultLanguage: string;
  appearance: {
    primaryColor: string;
    accentColor: string;
    launcherPosition: string;
    launcherIcon: string | null;
    borderRadius: number;
    colorScheme: string;
    font: string;
    logoUrl: string | null;
    avatarUrl: string | null;
    widgetWidth: number;
    widgetHeight: number;
  };
  behaviour: {
    welcomeMessage: string | null;
    suggestedQuestions: string[];
    showTypingIndicator: boolean;
    showBranding: boolean;
    offlineMessage: string | null;
    showTimestamp: boolean;
    showPoweredBy: boolean;
    autoOpen: boolean;
    autoOpenDelaySeconds: number;
  };
};

/**
 * Generic, indistinguishable failure for every rejection reason (unknown
 * key, wrong format, revoked key, disabled/draft/archived widget,
 * disallowed origin) — CLAUDE.md §4: "never leak whether a key format is
 * 'close' to valid, and never leak which organization a key would have
 * resolved to." Callers must not pattern-match on this message to
 * distinguish cases; the whole point is that they can't.
 */
const INVALID_WIDGET_ERROR = "Invalid widget configuration request";

/**
 * Resolves `publicKey → widget_keys → widgets → organization` and returns
 * only public-safe fields. Uses the service-role client because no visitor
 * session exists — one of the four documented CLAUDE.md §3.6 exceptions —
 * and manually re-scopes every query to the resolved widget/org itself,
 * since RLS provides no protection on this path.
 *
 * `originHostname` is the caller's already-extracted, lowercased Origin/
 * Referer hostname (or null if neither header was present). Domain
 * enforcement is opt-in: a widget with zero configured domains is not yet
 * restricted (every competitor widget platform behaves this way — a freshly
 * created widget must be embeddable before its owner has had a chance to
 * add an allowlist entry). The moment at least one domain is added for a
 * widget, only matching, enabled domains are accepted — see
 * modules/widget/public-config-service.test.ts for both cases.
 */
export async function resolvePublicWidgetConfig(
  publicKey: string,
  originHostname: string | null,
): Promise<PublicWidgetConfig> {
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

  if (allowedDomains.length > 0) {
    const isAllowed =
      originHostname !== null &&
      allowedDomains.some((d) => d.isEnabled && d.domain === originHostname);
    if (!isAllowed) {
      throw new Error(INVALID_WIDGET_ERROR);
    }
  }

  const [theme] = await db.select().from(widgetThemes).where(eq(widgetThemes.widgetId, widget.id)).limit(1);
  const [settings] = await db
    .select()
    .from(widgetSettings)
    .where(eq(widgetSettings.widgetId, widget.id))
    .limit(1);
  if (!theme || !settings) {
    // Every widget is provisioned with both rows at creation time
    // (widgets-service.ts) — reaching here means real data corruption, not
    // a caller error, so this is the one case that isn't the generic
    // public-facing message (nothing tenant-identifying in it either).
    throw new Error("Widget is not fully configured");
  }

  return {
    name: widget.name,
    defaultLanguage: widget.defaultLanguage,
    appearance: {
      primaryColor: theme.primaryColor,
      accentColor: theme.accentColor,
      launcherPosition: theme.launcherPosition,
      launcherIcon: theme.launcherIcon,
      borderRadius: theme.borderRadius,
      colorScheme: theme.colorScheme,
      font: theme.font,
      logoUrl: theme.logoUrl,
      avatarUrl: theme.avatarUrl,
      widgetWidth: theme.widgetWidth,
      widgetHeight: theme.widgetHeight,
    },
    behaviour: {
      welcomeMessage: settings.welcomeMessage,
      suggestedQuestions: Array.isArray(settings.suggestedQuestions)
        ? (settings.suggestedQuestions as string[])
        : [],
      showTypingIndicator: settings.showTypingIndicator,
      showBranding: settings.showBranding,
      offlineMessage: settings.offlineMessage,
      showTimestamp: settings.showTimestamp,
      showPoweredBy: settings.showPoweredBy,
      autoOpen: settings.autoOpen,
      autoOpenDelaySeconds: settings.autoOpenDelaySeconds,
    },
  };
}
