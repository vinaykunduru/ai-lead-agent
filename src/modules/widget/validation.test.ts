import { describe, expect, it } from "vitest";
import {
  createWidgetSchema,
  publicWidgetConfigQuerySchema,
  updateAppearanceSchema,
  updateBehaviourSchema,
  updateDomainsSchema,
  updateWidgetSchema,
  widgetIdSchema,
} from "./validation";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("createWidgetSchema", () => {
  it("accepts a minimal valid widget", () => {
    expect(createWidgetSchema.safeParse({ name: "Support Bot" }).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(createWidgetSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects a name over 100 characters", () => {
    expect(createWidgetSchema.safeParse({ name: "x".repeat(101) }).success).toBe(false);
  });
});

describe("updateWidgetSchema", () => {
  it("accepts a partial update with only status", () => {
    expect(updateWidgetSchema.safeParse({ status: "active" }).success).toBe(true);
  });

  it("rejects an unknown status value", () => {
    expect(updateWidgetSchema.safeParse({ status: "live" }).success).toBe(false);
  });
});

describe("widgetIdSchema", () => {
  it("requires a valid uuid", () => {
    expect(widgetIdSchema.safeParse({ widgetId: VALID_UUID }).success).toBe(true);
    expect(widgetIdSchema.safeParse({ widgetId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("updateDomainsSchema", () => {
  it("accepts a well-formed bare domain", () => {
    expect(
      updateDomainsSchema.safeParse({ domains: [{ domain: "example.com", isEnabled: true }] }).success,
    ).toBe(true);
    expect(
      updateDomainsSchema.safeParse({ domains: [{ domain: "support.example.com" }] }).success,
    ).toBe(true);
    expect(updateDomainsSchema.safeParse({ domains: [{ domain: "localhost:3000" }] }).success).toBe(true);
  });

  it("rejects a domain with a scheme or path", () => {
    expect(updateDomainsSchema.safeParse({ domains: [{ domain: "https://example.com" }] }).success).toBe(
      false,
    );
    expect(updateDomainsSchema.safeParse({ domains: [{ domain: "example.com/path" }] }).success).toBe(
      false,
    );
  });

  it("normalizes domains to lowercase", () => {
    const result = updateDomainsSchema.safeParse({ domains: [{ domain: "Example.COM" }] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.domains[0].domain).toBe("example.com");
  });

  it("caps the list at 20 domains", () => {
    const domains = Array.from({ length: 21 }, (_, i) => ({ domain: `site${i}.example.com` }));
    expect(updateDomainsSchema.safeParse({ domains }).success).toBe(false);
  });
});

describe("updateAppearanceSchema", () => {
  it("accepts valid hex colors, 3 and 6 digit", () => {
    expect(updateAppearanceSchema.safeParse({ primaryColor: "#4F46E5" }).success).toBe(true);
    expect(updateAppearanceSchema.safeParse({ primaryColor: "#fff" }).success).toBe(true);
  });

  it("rejects a non-hex color", () => {
    expect(updateAppearanceSchema.safeParse({ primaryColor: "indigo" }).success).toBe(false);
    expect(updateAppearanceSchema.safeParse({ primaryColor: "#gggggg" }).success).toBe(false);
  });

  it("treats an empty logoUrl as clearing the field, not an error", () => {
    expect(updateAppearanceSchema.safeParse({ logoUrl: "" }).success).toBe(true);
    expect(updateAppearanceSchema.safeParse({ logoUrl: null }).success).toBe(true);
  });

  it("rejects a non-empty logoUrl that isn't a valid URL", () => {
    expect(updateAppearanceSchema.safeParse({ logoUrl: "not a url" }).success).toBe(false);
  });

  it("accepts a valid logoUrl", () => {
    expect(updateAppearanceSchema.safeParse({ logoUrl: "https://example.com/logo.png" }).success).toBe(
      true,
    );
  });

  it("enforces widget width and height bounds", () => {
    expect(updateAppearanceSchema.safeParse({ widgetWidth: 100 }).success).toBe(false);
    expect(updateAppearanceSchema.safeParse({ widgetWidth: 380 }).success).toBe(true);
    expect(updateAppearanceSchema.safeParse({ widgetHeight: 2000 }).success).toBe(false);
  });
});

describe("updateBehaviourSchema", () => {
  it("caps suggested questions at 10", () => {
    const suggestedQuestions = Array.from({ length: 11 }, (_, i) => `Question ${i}`);
    expect(updateBehaviourSchema.safeParse({ suggestedQuestions }).success).toBe(false);
  });

  it("enforces auto-open delay bounds", () => {
    expect(updateBehaviourSchema.safeParse({ autoOpenDelaySeconds: -1 }).success).toBe(false);
    expect(updateBehaviourSchema.safeParse({ autoOpenDelaySeconds: 121 }).success).toBe(false);
    expect(updateBehaviourSchema.safeParse({ autoOpenDelaySeconds: 5 }).success).toBe(true);
  });
});

describe("publicWidgetConfigQuerySchema", () => {
  it("requires a non-empty key", () => {
    expect(publicWidgetConfigQuerySchema.safeParse({ key: "wgt_pub_abc123" }).success).toBe(true);
    expect(publicWidgetConfigQuerySchema.safeParse({ key: "" }).success).toBe(false);
    expect(publicWidgetConfigQuerySchema.safeParse({ key: null }).success).toBe(false);
  });
});
