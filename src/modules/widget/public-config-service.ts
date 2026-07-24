import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { widgetSettings, widgetThemes } from "@/db/schema";
import { resolveWidgetForPublicRequest } from "./resolve-public-request";

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
    sessionTimeoutMinutes: number;
  };
};

/**
 * Resolves `publicKey → widget_keys → widgets → organization` and returns
 * only public-safe fields. Widget/key/domain resolution itself lives in
 * resolve-public-request.ts, shared with
 * modules/conversation/execution-pipeline.ts — this function's only job is
 * shaping that internal Widget row (plus its theme/settings) into the
 * public-safe DTO below.
 *
 * `originHostname` is the caller's already-extracted, lowercased Origin/
 * Referer hostname (or null if neither header was present) — see
 * extractOriginHost in resolve-public-request.ts.
 */
export async function resolvePublicWidgetConfig(
  publicKey: string,
  originHostname: string | null,
): Promise<PublicWidgetConfig> {
  const widget = await resolveWidgetForPublicRequest(publicKey, originHostname);

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
      sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
    },
  };
}
