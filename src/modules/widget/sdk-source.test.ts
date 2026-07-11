import { describe, expect, it } from "vitest";
import { WIDGET_SDK_SOURCE } from "./sdk-source";

describe("WIDGET_SDK_SOURCE", () => {
  it("reads the public key from the script tag and fetches the public config endpoint", () => {
    expect(WIDGET_SDK_SOURCE).toContain("data-widget-key");
    expect(WIDGET_SDK_SOURCE).toContain("/api/widget/config?key=");
  });

  it("sends messages to the conversation engine's public endpoint and reads the response as a stream", () => {
    expect(WIDGET_SDK_SOURCE).toContain("/api/widget/messages");
    expect(WIDGET_SDK_SOURCE).toContain("response.body");
    expect(WIDGET_SDK_SOURCE).toContain("getReader");
  });

  it("persists a stable, client-generated visitor id rather than a server-issued credential", () => {
    expect(WIDGET_SDK_SOURCE).toContain("localStorage");
    expect(WIDGET_SDK_SOURCE).toContain("visitorId");
  });

  it("never references a service key, secret, or database credential", () => {
    const forbidden = ["SUPABASE_SERVICE_ROLE", "DATABASE_URL", "service_role", "secret", "organizationId"];
    for (const term of forbidden) {
      expect(WIDGET_SDK_SOURCE.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it("never talks to a vendor AI API directly — only this app's own backend", () => {
    for (const term of ["api.openai.com", "api.anthropic.com", "generativelanguage.googleapis.com"]) {
      expect(WIDGET_SDK_SOURCE.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it("never opens a WebSocket (module spec: SSE only)", () => {
    expect(WIDGET_SDK_SOURCE).not.toContain("WebSocket");
    expect(WIDGET_SDK_SOURCE).not.toContain("new EventSource");
  });

  it("is a self-invoking function (safe to drop into any page via a script tag)", () => {
    expect(WIDGET_SDK_SOURCE.trim().startsWith("(function () {")).toBe(true);
    expect(WIDGET_SDK_SOURCE.trim().endsWith("})();")).toBe(true);
  });
});
