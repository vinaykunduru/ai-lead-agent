import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const aiPersonalityTypeEnum = pgEnum("ai_personality_type", [
  "professional",
  "friendly",
  "technical",
  "luxury",
  "healthcare",
  "legal",
  "sales",
  "custom",
]);

export const aiResponseDetailEnum = pgEnum("ai_response_detail", ["concise", "balanced", "detailed"]);

export const aiEmojiUsageEnum = pgEnum("ai_emoji_usage", ["none", "minimal", "frequent"]);

/**
 * One row per organization — the AI Brain's configuration (Identity,
 * Personality, Response Settings, Language, and the Safety fallback
 * message). Lazily created on first access, the same pattern as
 * modules/knowledge's default collection (CLAUDE.md's decoupled-modules
 * rule: no foreign key or trigger from organizations into this table).
 *
 * Everything else in the "Safety" spec section (ignore prompt injection,
 * never expose system prompts/embeddings/storage paths, never fabricate
 * information) is a platform-level guardrail, not a per-org column here —
 * see modules/ai-behaviour/prompt-generator.ts and CLAUDE.md §5
 * ("platform-level instructions ... can never be overridden by company
 * configuration").
 */
export const aiProfiles = pgTable("ai_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),

  // Identity
  assistantName: text("assistant_name").notNull().default("Assistant"),
  assistantDescription: text("assistant_description"),
  companySummary: text("company_summary"),
  role: text("role"),

  // Personality
  personalityType: aiPersonalityTypeEnum("personality_type").notNull().default("professional"),
  customPersonalityDescription: text("custom_personality_description"),
  responseStyle: text("response_style"),
  communicationPreferences: text("communication_preferences"),

  // Response settings
  maxResponseLength: integer("max_response_length").notNull().default(500),
  responseDetail: aiResponseDetailEnum("response_detail").notNull().default("balanced"),
  emojiUsage: aiEmojiUsageEnum("emoji_usage").notNull().default("minimal"),
  markdownEnabled: boolean("markdown_enabled").notNull().default(true),
  bulletListPreference: boolean("bullet_list_preference").notNull().default(true),
  askFollowUpQuestions: boolean("ask_follow_up_questions").notNull().default(true),
  oneQuestionAtATime: boolean("one_question_at_a_time").notNull().default(true),
  alwaysConcise: boolean("always_concise").notNull().default(false),

  // Language
  primaryLanguage: text("primary_language").notNull().default("en"),
  supportedLanguages: jsonb("supported_languages").notNull().default(["en"]),
  autoDetectLanguage: boolean("auto_detect_language").notNull().default(true),
  fallbackLanguage: text("fallback_language").notNull().default("en"),

  // Safety — the one configurable knob; everything else is a fixed
  // platform-level guardrail (see module doc comment above). Null falls
  // back to DEFAULT_SAFETY_FALLBACK_MESSAGE at the service layer.
  safetyFallbackMessage: text("safety_fallback_message"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiProfile = typeof aiProfiles.$inferSelect;
export type NewAiProfile = typeof aiProfiles.$inferInsert;
