import { z } from "zod";
import { PROMPT_RENDERER_IDS } from "./rendering/types";

export const PERSONALITY_TYPES = [
  "professional",
  "friendly",
  "technical",
  "luxury",
  "healthcare",
  "legal",
  "sales",
  "custom",
] as const;

export const RESPONSE_DETAIL_LEVELS = ["concise", "balanced", "detailed"] as const;
export const EMOJI_USAGE_LEVELS = ["none", "minimal", "frequent"] as const;
export const LEAD_QUESTION_VALIDATION_TYPES = ["none", "email", "phone", "number", "text"] as const;
export const WORKING_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

export const updateAiProfileSchema = z.object({
  assistantName: z.string().trim().min(1).max(100).optional(),
  assistantDescription: z.string().trim().max(1000).nullable().optional(),
  companySummary: z.string().trim().max(2000).nullable().optional(),
  role: z.string().trim().max(200).nullable().optional(),

  personalityType: z.enum(PERSONALITY_TYPES).optional(),
  customPersonalityDescription: z.string().trim().max(1000).nullable().optional(),
  responseStyle: z.string().trim().max(500).nullable().optional(),
  communicationPreferences: z.string().trim().max(1000).nullable().optional(),

  maxResponseLength: z.number().int().min(50).max(4000).optional(),
  responseDetail: z.enum(RESPONSE_DETAIL_LEVELS).optional(),
  emojiUsage: z.enum(EMOJI_USAGE_LEVELS).optional(),
  markdownEnabled: z.boolean().optional(),
  bulletListPreference: z.boolean().optional(),
  askFollowUpQuestions: z.boolean().optional(),
  oneQuestionAtATime: z.boolean().optional(),
  alwaysConcise: z.boolean().optional(),

  primaryLanguage: z.string().trim().min(2).max(10).optional(),
  supportedLanguages: z.array(z.string().trim().min(2).max(10)).min(1).max(20).optional(),
  autoDetectLanguage: z.boolean().optional(),
  fallbackLanguage: z.string().trim().min(2).max(10).optional(),

  safetyFallbackMessage: z.string().trim().max(500).nullable().optional(),
});
export type UpdateAiProfileInput = z.infer<typeof updateAiProfileSchema>;

const businessRuleInputSchema = z.object({
  id: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(300),
  isEnabled: z.boolean().default(true),
});

export const updateBusinessRulesSchema = z.object({
  rules: z.array(businessRuleInputSchema).max(50),
});
export type UpdateBusinessRulesInput = z.infer<typeof updateBusinessRulesSchema>;

const leadQuestionInputSchema = z.object({
  id: z.string().uuid().optional(),
  fieldKey: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, and underscores only"),
  label: z.string().trim().min(1).max(100),
  isRequired: z.boolean().default(true),
  placeholder: z.string().trim().max(200).nullable().optional(),
  validationType: z.enum(LEAD_QUESTION_VALIDATION_TYPES).default("none"),
});

export const updateLeadQuestionsSchema = z.object({
  questions: z.array(leadQuestionInputSchema).max(30),
});
export type UpdateLeadQuestionsInput = z.infer<typeof updateLeadQuestionsSchema>;

export const updateBusinessHoursSchema = z.object({
  workingDays: z.array(z.enum(WORKING_DAYS)).max(7).optional(),
  startTime: z.string().regex(TIME_OF_DAY, "Use 24-hour HH:MM format").optional(),
  endTime: z.string().regex(TIME_OF_DAY, "Use 24-hour HH:MM format").optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  holidayMode: z.boolean().optional(),
  outsideHoursResponse: z.string().trim().max(500).nullable().optional(),
});
export type UpdateBusinessHoursInput = z.infer<typeof updateBusinessHoursSchema>;

export const updateHandoffSettingsSchema = z.object({
  escalationEnabled: z.boolean().optional(),
  escalationEmail: z.string().trim().email().nullable().optional(),
  escalationMessage: z.string().trim().max(1000).nullable().optional(),
  manualReviewRequired: z.boolean().optional(),
  maxAiAttempts: z.number().int().min(1).max(10).optional(),
});
export type UpdateHandoffSettingsInput = z.infer<typeof updateHandoffSettingsSchema>;

export const playgroundTestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  language: z.string().trim().min(2).max(10).optional(),
  personalityOverride: z.enum(PERSONALITY_TYPES).optional(),
  renderer: z.enum(PROMPT_RENDERER_IDS).default("openai"),
});
export type PlaygroundTestInput = z.infer<typeof playgroundTestSchema>;
