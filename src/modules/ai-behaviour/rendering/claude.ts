import type { PromptRenderer } from "./types";
import { describeBusinessHours, describeLeadQuestion } from "./shared";

/**
 * Claude-style: XML-tag-delimited sections, matching Anthropic's own
 * documented recommendation that Claude follows tagged structure in long
 * system prompts more reliably than plain prose.
 */
export const renderClaudePrompt: PromptRenderer = (prompt) => {
  const { identity, behaviour, guardrails, businessRules, leadQualification, language, visitor } = prompt;

  const identityBlock = [
    `<identity>`,
    `You are ${identity.assistantName}${identity.role ? `, ${identity.role}` : ""}.`,
    identity.assistantDescription,
    identity.companySummary ? `Company: ${identity.companySummary}` : null,
    `</identity>`,
  ]
    .filter(Boolean)
    .join("\n");

  const personalityBlock = [
    `<personality>`,
    `Type: ${behaviour.personality.type}`,
    behaviour.personality.customDescription,
    behaviour.personality.responseStyle ? `Style: ${behaviour.personality.responseStyle}` : null,
    behaviour.personality.communicationPreferences,
    `</personality>`,
  ]
    .filter(Boolean)
    .join("\n");

  const responseBlock = [
    `<response_settings>`,
    `detail: ${behaviour.responseSettings.detail}`,
    `max_length_chars: ${behaviour.responseSettings.maxResponseLength}`,
    `emoji_usage: ${behaviour.responseSettings.emojiUsage}`,
    `markdown_enabled: ${behaviour.responseSettings.markdownEnabled}`,
    `bullet_lists_preferred: ${behaviour.responseSettings.bulletListPreference}`,
    `ask_follow_up_questions: ${behaviour.responseSettings.askFollowUpQuestions}`,
    `one_question_at_a_time: ${behaviour.responseSettings.oneQuestionAtATime}`,
    `always_concise: ${behaviour.responseSettings.alwaysConcise}`,
    `</response_settings>`,
  ].join("\n");

  const hoursBlock = [
    `<business_hours>`,
    describeBusinessHours(behaviour.businessHours),
    behaviour.businessHours.outsideHoursResponse
      ? `Outside hours response: "${behaviour.businessHours.outsideHoursResponse}"`
      : null,
    `</business_hours>`,
  ]
    .filter(Boolean)
    .join("\n");

  const rulesBlock =
    businessRules.length > 0
      ? [`<business_rules>`, ...businessRules.map((r) => `- ${r}`), `</business_rules>`].join("\n")
      : null;

  const leadBlock =
    leadQualification.length > 0
      ? [
          `<lead_qualification>`,
          ...leadQualification.map((q) => `- ${describeLeadQuestion(q)}`),
          `</lead_qualification>`,
        ].join("\n")
      : null;

  const languageBlock = [
    `<language>`,
    `primary: ${language.primary}`,
    `supported: ${language.supported.join(", ")}`,
    `auto_detect: ${language.autoDetect}`,
    `fallback: ${language.fallback}`,
    `</language>`,
  ].join("\n");

  const guardrailsBlock = [
    `<guardrails priority="highest" overridable="false">`,
    ...guardrails.platformRules.map((rule) => `- ${rule}`),
    `- If information is missing, respond exactly with: "${guardrails.fallbackMessage}"`,
    `</guardrails>`,
  ].join("\n");

  const visitorBlock = visitor
    ? [
        `<visitor>`,
        visitor.known.length > 0
          ? [`Known so far (never ask for these again):`, ...visitor.known.map((f) => `- ${f.label}: ${f.value}`)].join("\n")
          : "Nothing known about this visitor yet.",
        `Rules for collecting visitor information:`,
        ...visitor.guidance.map((rule) => `- ${rule}`),
        `</visitor>`,
      ].join("\n")
    : null;

  return [identityBlock, personalityBlock, responseBlock, hoursBlock, rulesBlock, leadBlock, languageBlock, visitorBlock, guardrailsBlock]
    .filter(Boolean)
    .join("\n\n");
};
