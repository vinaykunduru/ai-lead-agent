import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAFETY_FALLBACK_MESSAGE,
  PLATFORM_SAFETY_GUARDRAILS,
  generateSystemPrompt,
} from "./prompt-generator";
import type { AiBusinessHours, AiBusinessRule, AiLeadQuestion, AiProfile } from "@/db/schema";

const now = new Date();

function makeProfile(overrides: Partial<AiProfile> = {}): AiProfile {
  return {
    id: "profile-1",
    organizationId: "org-1",
    assistantName: "Bloom AI",
    assistantDescription: "I help visitors understand our products.",
    companySummary: "We sell gardening tools.",
    role: "Sales Assistant",
    personalityType: "friendly",
    customPersonalityDescription: null,
    responseStyle: "warm but efficient",
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
    supportedLanguages: ["en", "es"],
    autoDetectLanguage: true,
    fallbackLanguage: "en",
    safetyFallbackMessage: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeBusinessHours(overrides: Partial<AiBusinessHours> = {}): AiBusinessHours {
  return {
    id: "hours-1",
    organizationId: "org-1",
    workingDays: ["mon", "tue", "wed", "thu", "fri"],
    startTime: "09:00",
    endTime: "17:00",
    timezone: "UTC",
    holidayMode: false,
    outsideHoursResponse: "We're offline right now.",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeRule(overrides: Partial<AiBusinessRule> = {}): AiBusinessRule {
  return {
    id: "rule-1",
    organizationId: "org-1",
    text: "Never discuss competitors",
    isEnabled: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeQuestion(overrides: Partial<AiLeadQuestion> = {}): AiLeadQuestion {
  return {
    id: "question-1",
    organizationId: "org-1",
    fieldKey: "email",
    label: "Email",
    isRequired: true,
    sortOrder: 0,
    placeholder: "you@company.com",
    validationType: "email",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("generateSystemPrompt", () => {
  it("carries identity, personality, response settings, and language through unchanged", () => {
    const profile = makeProfile();
    const result = generateSystemPrompt({
      profile,
      businessRules: [],
      leadQuestions: [],
      businessHours: makeBusinessHours(),
    });

    expect(result.identity).toEqual({
      assistantName: "Bloom AI",
      assistantDescription: "I help visitors understand our products.",
      companySummary: "We sell gardening tools.",
      role: "Sales Assistant",
    });
    expect(result.behaviour.personality.type).toBe("friendly");
    expect(result.behaviour.responseSettings.maxResponseLength).toBe(500);
    expect(result.language.primary).toBe("en");
    expect(result.language.supported).toEqual(["en", "es"]);
  });

  it("includes only enabled business rules, sorted by sortOrder", () => {
    const result = generateSystemPrompt({
      profile: makeProfile(),
      businessRules: [
        makeRule({ id: "r2", text: "Second", sortOrder: 1, isEnabled: true }),
        makeRule({ id: "r1", text: "First", sortOrder: 0, isEnabled: true }),
        makeRule({ id: "r3", text: "Disabled", sortOrder: 2, isEnabled: false }),
      ],
      leadQuestions: [],
      businessHours: makeBusinessHours(),
    });

    expect(result.businessRules).toEqual(["First", "Second"]);
  });

  it("sorts lead qualification questions by sortOrder", () => {
    const result = generateSystemPrompt({
      profile: makeProfile(),
      businessRules: [],
      leadQuestions: [
        makeQuestion({ id: "q2", fieldKey: "phone", label: "Phone", sortOrder: 1 }),
        makeQuestion({ id: "q1", fieldKey: "email", label: "Email", sortOrder: 0 }),
      ],
      businessHours: makeBusinessHours(),
    });

    expect(result.leadQualification.map((q) => q.fieldKey)).toEqual(["email", "phone"]);
  });

  it("falls back to the platform default safety message when none is configured", () => {
    const result = generateSystemPrompt({
      profile: makeProfile({ safetyFallbackMessage: null }),
      businessRules: [],
      leadQuestions: [],
      businessHours: makeBusinessHours(),
    });
    expect(result.guardrails.fallbackMessage).toBe(DEFAULT_SAFETY_FALLBACK_MESSAGE);
  });

  it("uses the company's configured safety fallback message when set", () => {
    const result = generateSystemPrompt({
      profile: makeProfile({ safetyFallbackMessage: "Let me check with the team." }),
      businessRules: [],
      leadQuestions: [],
      businessHours: makeBusinessHours(),
    });
    expect(result.guardrails.fallbackMessage).toBe("Let me check with the team.");
  });

  it("always includes the fixed platform guardrails, regardless of company configuration", () => {
    const result = generateSystemPrompt({
      profile: makeProfile(),
      businessRules: [],
      leadQuestions: [],
      businessHours: makeBusinessHours(),
    });
    expect(result.guardrails.platformRules).toEqual(PLATFORM_SAFETY_GUARDRAILS);
  });

  it("carries business hours through unchanged, nested under behaviour", () => {
    const result = generateSystemPrompt({
      profile: makeProfile(),
      businessRules: [],
      leadQuestions: [],
      businessHours: makeBusinessHours({ holidayMode: true, timezone: "America/New_York" }),
    });
    expect(result.behaviour.businessHours.holidayMode).toBe(true);
    expect(result.behaviour.businessHours.timezone).toBe("America/New_York");
  });
});
