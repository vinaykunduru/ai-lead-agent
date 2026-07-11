import "server-only";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { getAiProfile } from "./profile-service";
import { listBusinessRules } from "./business-rules-service";
import { listLeadQuestions } from "./lead-questions-service";
import { getBusinessHours } from "./business-hours-service";
import { generateSystemPrompt, type StructuredPrompt } from "./prompt-generator";
import { isWithinBusinessHours } from "./business-hours-utils";
import { renderStructuredPrompt, type PromptRendererId } from "./rendering";
import type { AiProfile } from "@/db/schema";
import type { PlaygroundTestInput } from "./validation";

export type PlaygroundTestResult = {
  /**
   * Clearly-labeled, deterministically generated preview — Phase 3 does not
   * call a live AI provider (see module scope: "Do NOT build live AI
   * conversations"). This screen previews the *configuration* a real chat
   * engine would use, once that engine exists in a later phase.
   */
  mockReply: string;
  promptPreview: StructuredPrompt;
  /** The same promptPreview, rendered as vendor-specific text — never the
   * generator itself doing vendor formatting, see ./rendering. */
  renderedPrompt: { rendererId: PromptRendererId; text: string };
  appliedLanguage: string;
  appliedPersonality: AiProfile["personalityType"];
  withinBusinessHours: boolean;
};

export async function runPlaygroundTest(input: PlaygroundTestInput): Promise<PlaygroundTestResult> {
  const session = await requireCompanySession();
  assertPermission(session, "ai.test");

  const [profile, businessRules, leadQuestions, businessHours] = await Promise.all([
    getAiProfile(),
    listBusinessRules(),
    listLeadQuestions(),
    getBusinessHours(),
  ]);

  const appliedPersonality = input.personalityOverride ?? profile.personalityType;
  const appliedLanguage = input.language ?? profile.primaryLanguage;

  const promptPreview = generateSystemPrompt({
    profile: { ...profile, personalityType: appliedPersonality, primaryLanguage: appliedLanguage },
    businessRules,
    leadQuestions,
    businessHours,
  });

  const withinBusinessHours = isWithinBusinessHours(
    {
      workingDays: Array.isArray(businessHours.workingDays) ? (businessHours.workingDays as string[]) : [],
      startTime: businessHours.startTime,
      endTime: businessHours.endTime,
      timezone: businessHours.timezone,
      holidayMode: businessHours.holidayMode,
    },
    new Date(),
  );

  const enabledRuleCount = promptPreview.businessRules.length;
  const mockReply = [
    "[Preview only — no AI provider is called in Phase 3]",
    `${promptPreview.identity.assistantName} would reply in a "${appliedPersonality}" tone (${promptPreview.behaviour.responseSettings.detail} detail, ${appliedLanguage}), `,
    `applying ${enabledRuleCount} active business rule${enabledRuleCount === 1 ? "" : "s"}`,
    withinBusinessHours ? " during business hours." : " outside business hours.",
  ].join("");

  const rendererId = input.renderer;
  const renderedPrompt = { rendererId, text: renderStructuredPrompt(rendererId, promptPreview) };

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "ai_behaviour.playground_tested",
    resourceType: "ai_profile",
    resourceId: profile.id,
    // Never the visitor-authored message or any generated reply text.
    metadata: { language: appliedLanguage, personality: appliedPersonality, renderer: rendererId },
  });

  return { mockReply, promptPreview, renderedPrompt, appliedLanguage, appliedPersonality, withinBusinessHours };
}
