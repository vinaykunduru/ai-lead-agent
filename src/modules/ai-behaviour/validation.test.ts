import { describe, expect, it } from "vitest";
import {
  updateAiProfileSchema,
  updateBusinessRulesSchema,
  updateLeadQuestionsSchema,
  updateBusinessHoursSchema,
  updateHandoffSettingsSchema,
  playgroundTestSchema,
} from "./validation";

describe("updateAiProfileSchema", () => {
  it("accepts a partial update with only some fields", () => {
    expect(updateAiProfileSchema.safeParse({ assistantName: "Bloom AI" }).success).toBe(true);
    expect(updateAiProfileSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an out-of-range maxResponseLength", () => {
    expect(updateAiProfileSchema.safeParse({ maxResponseLength: 10 }).success).toBe(false);
    expect(updateAiProfileSchema.safeParse({ maxResponseLength: 5000 }).success).toBe(false);
    expect(updateAiProfileSchema.safeParse({ maxResponseLength: 500 }).success).toBe(true);
  });

  it("rejects an invalid personalityType", () => {
    expect(updateAiProfileSchema.safeParse({ personalityType: "mysterious" }).success).toBe(false);
    expect(updateAiProfileSchema.safeParse({ personalityType: "friendly" }).success).toBe(true);
  });

  it("rejects an empty supportedLanguages array", () => {
    expect(updateAiProfileSchema.safeParse({ supportedLanguages: [] }).success).toBe(false);
    expect(updateAiProfileSchema.safeParse({ supportedLanguages: ["en"] }).success).toBe(true);
  });

  it("allows nullable text fields to be explicitly cleared", () => {
    expect(updateAiProfileSchema.safeParse({ assistantDescription: null }).success).toBe(true);
  });
});

describe("updateBusinessRulesSchema", () => {
  it("accepts a list of rules with and without ids", () => {
    const result = updateBusinessRulesSchema.safeParse({
      rules: [
        { id: "123e4567-e89b-12d3-a456-426614174000", text: "Existing rule", isEnabled: true },
        { text: "New rule", isEnabled: false },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a rule with empty text", () => {
    expect(updateBusinessRulesSchema.safeParse({ rules: [{ text: "" }] }).success).toBe(false);
  });

  it("rejects more than 50 rules", () => {
    const rules = Array.from({ length: 51 }, (_, i) => ({ text: `Rule ${i}` }));
    expect(updateBusinessRulesSchema.safeParse({ rules }).success).toBe(false);
  });
});

describe("updateLeadQuestionsSchema", () => {
  it("accepts a valid question list", () => {
    const result = updateLeadQuestionsSchema.safeParse({
      questions: [{ fieldKey: "email", label: "Email", validationType: "email" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a fieldKey with invalid characters", () => {
    expect(
      updateLeadQuestionsSchema.safeParse({ questions: [{ fieldKey: "Email Address!", label: "Email" }] })
        .success,
    ).toBe(false);
  });

  it("rejects an invalid validationType", () => {
    expect(
      updateLeadQuestionsSchema.safeParse({
        questions: [{ fieldKey: "email", label: "Email", validationType: "regex" }],
      }).success,
    ).toBe(false);
  });
});

describe("updateBusinessHoursSchema", () => {
  it("accepts valid HH:MM times", () => {
    expect(updateBusinessHoursSchema.safeParse({ startTime: "09:00", endTime: "17:30" }).success).toBe(
      true,
    );
  });

  it("rejects malformed times", () => {
    expect(updateBusinessHoursSchema.safeParse({ startTime: "9:00" }).success).toBe(false);
    expect(updateBusinessHoursSchema.safeParse({ startTime: "25:00" }).success).toBe(false);
    expect(updateBusinessHoursSchema.safeParse({ startTime: "09:60" }).success).toBe(false);
  });

  it("rejects an invalid working day", () => {
    expect(updateBusinessHoursSchema.safeParse({ workingDays: ["mon", "funday"] }).success).toBe(false);
  });

  it("allows an empty workingDays array (e.g. always closed)", () => {
    expect(updateBusinessHoursSchema.safeParse({ workingDays: [] }).success).toBe(true);
  });
});

describe("updateHandoffSettingsSchema", () => {
  it("accepts a valid configuration", () => {
    expect(
      updateHandoffSettingsSchema.safeParse({
        escalationEnabled: true,
        escalationEmail: "support@example.com",
        maxAiAttempts: 3,
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(updateHandoffSettingsSchema.safeParse({ escalationEmail: "not-an-email" }).success).toBe(false);
  });

  it("rejects maxAiAttempts outside 1-10", () => {
    expect(updateHandoffSettingsSchema.safeParse({ maxAiAttempts: 0 }).success).toBe(false);
    expect(updateHandoffSettingsSchema.safeParse({ maxAiAttempts: 11 }).success).toBe(false);
  });
});

describe("playgroundTestSchema", () => {
  it("requires a non-empty message", () => {
    expect(playgroundTestSchema.safeParse({ message: "" }).success).toBe(false);
    expect(playgroundTestSchema.safeParse({ message: "Hello" }).success).toBe(true);
  });

  it("rejects a message over 2000 characters", () => {
    expect(playgroundTestSchema.safeParse({ message: "x".repeat(2001) }).success).toBe(false);
  });

  it("rejects an invalid personalityOverride", () => {
    expect(
      playgroundTestSchema.safeParse({ message: "hi", personalityOverride: "mysterious" }).success,
    ).toBe(false);
  });
});
