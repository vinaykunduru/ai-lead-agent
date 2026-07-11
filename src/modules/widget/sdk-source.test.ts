import { describe, expect, it } from "vitest";
import { WIDGET_SDK_SOURCE } from "./sdk-source";

describe("WIDGET_SDK_SOURCE", () => {
  it("reads the public key from the script tag and fetches the public config endpoint", () => {
    expect(WIDGET_SDK_SOURCE).toContain("data-widget-key");
    expect(WIDGET_SDK_SOURCE).toContain("/api/widget/config?key=");
  });

  it("never references a service key, secret, or database credential", () => {
    const forbidden = ["SUPABASE_SERVICE_ROLE", "DATABASE_URL", "service_role", "secret", "organizationId"];
    for (const term of forbidden) {
      expect(WIDGET_SDK_SOURCE.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it("does not call any AI provider or streaming API", () => {
    for (const term of ["openai", "anthropic", "chat/completions", "text/event-stream", "EventSource"]) {
      expect(WIDGET_SDK_SOURCE.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it("is a self-invoking function (safe to drop into any page via a script tag)", () => {
    expect(WIDGET_SDK_SOURCE.trim().startsWith("(function () {")).toBe(true);
    expect(WIDGET_SDK_SOURCE.trim().endsWith("})();")).toBe(true);
  });
});
