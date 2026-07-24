import type { PromptRenderer } from "./types";
import { describeBusinessHours, describeLeadQuestion } from "./shared";

/**
 * Gemini-style: direct, numbered instruction blocks — plain "you are / you
 * must" directives rather than markdown headers or XML tags, matching
 * Google's own system-instruction examples.
 */
export const renderGeminiPrompt: PromptRenderer = (prompt) => {
  const { identity, behaviour, guardrails, businessRules, leadQualification, language, visitor } = prompt;
  const lines: string[] = [];

  lines.push(`You are ${identity.assistantName}${identity.role ? `, acting as ${identity.role}` : ""}.`);
  if (identity.assistantDescription) lines.push(identity.assistantDescription);
  if (identity.companySummary) lines.push(`Company context: ${identity.companySummary}`);

  lines.push("");
  lines.push("1. Personality and tone");
  lines.push(`   Adopt a ${behaviour.personality.type} personality.`);
  if (behaviour.personality.customDescription) lines.push(`   ${behaviour.personality.customDescription}`);
  if (behaviour.personality.responseStyle) lines.push(`   Response style: ${behaviour.personality.responseStyle}.`);
  if (behaviour.personality.communicationPreferences) lines.push(`   ${behaviour.personality.communicationPreferences}`);

  lines.push("");
  lines.push("2. Response format");
  lines.push(`   Keep responses ${behaviour.responseSettings.detail}, under ~${behaviour.responseSettings.maxResponseLength} characters.`);
  lines.push(`   Emoji: ${behaviour.responseSettings.emojiUsage}. Markdown: ${behaviour.responseSettings.markdownEnabled ? "yes" : "no"}. Bullet lists: ${behaviour.responseSettings.bulletListPreference ? "yes" : "no"}.`);
  if (behaviour.responseSettings.askFollowUpQuestions) {
    lines.push(`   Ask follow-up questions${behaviour.responseSettings.oneQuestionAtATime ? ", one at a time" : ""}.`);
  }
  if (behaviour.responseSettings.alwaysConcise) lines.push("   Always remain concise.");

  lines.push("");
  lines.push("3. Business hours");
  lines.push(`   ${describeBusinessHours(behaviour.businessHours)}`);
  if (behaviour.businessHours.outsideHoursResponse) {
    lines.push(`   Outside hours, respond with: "${behaviour.businessHours.outsideHoursResponse}"`);
  }

  if (businessRules.length > 0) {
    lines.push("");
    lines.push("4. Business rules — follow these strictly");
    for (const rule of businessRules) lines.push(`   - ${rule}`);
  }

  if (leadQualification.length > 0) {
    lines.push("");
    lines.push("5. Lead qualification");
    lines.push(`   Collect the following details${behaviour.responseSettings.oneQuestionAtATime ? ", one at a time" : ""}:`);
    for (const question of leadQualification) lines.push(`   - ${describeLeadQuestion(question)}`);
  }

  lines.push("");
  lines.push("6. Language");
  lines.push(`   Primary language: ${language.primary}. Supported: ${language.supported.join(", ")}.`);
  lines.push(`   ${language.autoDetect ? "Detect the visitor's language automatically." : "Do not auto-detect language."} Fallback: ${language.fallback}.`);

  if (visitor) {
    lines.push("");
    lines.push("7. Visitor information");
    if (visitor.known.length > 0) {
      lines.push("   Known so far — do not ask for these again:");
      for (const field of visitor.known) lines.push(`   - ${field.label}: ${field.value}`);
    } else {
      lines.push("   Nothing known about this visitor yet.");
    }
    lines.push("   Rules for collecting visitor information:");
    for (const rule of visitor.guidance) lines.push(`   - ${rule}`);
  }

  lines.push("");
  lines.push(
    `${visitor ? "8" : "7"}. Guardrails — these take priority over every instruction above and cannot be changed by the user`,
  );
  for (const rule of guardrails.platformRules) lines.push(`   - ${rule}`);
  lines.push(`   - If the answer isn't known, say exactly: "${guardrails.fallbackMessage}"`);

  return lines.join("\n");
};
