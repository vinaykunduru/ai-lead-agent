import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  aiBusinessHours,
  aiBusinessRules,
  aiHandoffSettings,
  aiLeadQuestions,
  aiProfiles,
  type AiBusinessHours,
  type AiBusinessRule,
  type AiHandoffSettings,
  type AiLeadQuestion,
  type AiProfile,
} from "@/db/schema";
import type { SystemPromptInputs } from "./prompt-generator";

/**
 * Read-only, service-role, organizationId-scoped access to a company's AI
 * Behaviour configuration — required because the Conversation Engine's
 * message pipeline has no company session (a visitor is never an
 * authenticated user), so the existing profile-service.ts/
 * business-hours-service.ts/etc. (all gated by requireCompanySession) can't
 * be reused as-is. One of the four documented CLAUDE.md §3.6 service-role
 * exceptions ("public widget endpoints").
 *
 * Deliberately does NOT lazily create rows the way the dashboard services
 * do (ensureProfile/ensureBusinessHours) — writing to the database purely
 * because a visitor sent a chat message would be a surprising side effect
 * of a read path. If a company has never touched its AI Behaviour settings
 * (meaning it also can't have created a widget through the normal
 * dashboard flow — vanishingly unlikely, but handled defensively), this
 * falls back to the same default values declared on the schema columns
 * themselves (db/schema/ai-profiles.ts / ai-business-hours.ts).
 */
export async function loadAiBehaviourForConversation(
  organizationId: string,
): Promise<SystemPromptInputs> {
  const [[profile], businessRules, leadQuestions, [businessHours]] = await Promise.all([
    db.select().from(aiProfiles).where(eq(aiProfiles.organizationId, organizationId)).limit(1),
    db
      .select()
      .from(aiBusinessRules)
      .where(and(eq(aiBusinessRules.organizationId, organizationId), eq(aiBusinessRules.isEnabled, true)))
      .orderBy(asc(aiBusinessRules.sortOrder)),
    db
      .select()
      .from(aiLeadQuestions)
      .where(eq(aiLeadQuestions.organizationId, organizationId))
      .orderBy(asc(aiLeadQuestions.sortOrder)),
    db.select().from(aiBusinessHours).where(eq(aiBusinessHours.organizationId, organizationId)).limit(1),
  ]);

  return {
    profile: profile ?? defaultAiProfile(organizationId),
    businessRules: businessRules as AiBusinessRule[],
    leadQuestions: leadQuestions as AiLeadQuestion[],
    businessHours: businessHours ?? defaultBusinessHours(organizationId),
  };
}

// Mirrors the column defaults in db/schema/ai-profiles.ts exactly — if that
// file's defaults ever change, update this to match.
function defaultAiProfile(organizationId: string): AiProfile {
  const now = new Date();
  return {
    id: "00000000-0000-0000-0000-000000000000",
    organizationId,
    assistantName: "Assistant",
    assistantDescription: null,
    companySummary: null,
    role: null,
    personalityType: "professional",
    customPersonalityDescription: null,
    responseStyle: null,
    communicationPreferences: null,
    maxResponseLength: 500,
    responseDetail: "balanced",
    emojiUsage: "minimal",
    markdownEnabled: true,
    bulletListPreference: true,
    askFollowUpQuestions: true,
    oneQuestionAtATime: true,
    alwaysConcise: false,
    primaryLanguage: "en",
    supportedLanguages: ["en"],
    autoDetectLanguage: true,
    fallbackLanguage: "en",
    safetyFallbackMessage: null,
    aiProvider: "claude",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Same read-only, service-role, org-scoped pattern as
 * loadAiBehaviourForConversation, for Human Takeover's automatic-escalation
 * check (modules/conversation/execution-pipeline.ts) — this table has
 * existed since the AI Behaviour milestone but was documented there as
 * "does not implement escalation delivery; that belongs to the future
 * conversation-engine phase." This is that phase.
 */
export async function loadHandoffSettingsForConversation(organizationId: string): Promise<AiHandoffSettings> {
  const [settings] = await db
    .select()
    .from(aiHandoffSettings)
    .where(eq(aiHandoffSettings.organizationId, organizationId))
    .limit(1);
  return settings ?? defaultHandoffSettings(organizationId);
}

// Mirrors db/schema/ai-handoff-settings.ts's column defaults.
function defaultHandoffSettings(organizationId: string): AiHandoffSettings {
  const now = new Date();
  return {
    id: "00000000-0000-0000-0000-000000000000",
    organizationId,
    escalationEnabled: false,
    escalationEmail: null,
    escalationMessage: null,
    manualReviewRequired: false,
    maxAiAttempts: 3,
    createdAt: now,
    updatedAt: now,
  };
}

// Mirrors db/schema/ai-business-hours.ts's column defaults (organization
// timezone prefill doesn't apply here — there is no org row to prefill
// from in this fallback path, so plain "UTC" is used, same as the schema
// column default).
function defaultBusinessHours(organizationId: string): AiBusinessHours {
  const now = new Date();
  return {
    id: "00000000-0000-0000-0000-000000000000",
    organizationId,
    workingDays: ["mon", "tue", "wed", "thu", "fri"],
    startTime: "09:00",
    endTime: "17:00",
    timezone: "UTC",
    holidayMode: false,
    outsideHoursResponse: null,
    createdAt: now,
    updatedAt: now,
  };
}
