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

  it("polls for new messages (e.g. a human agent's Inbox reply) via a plain GET, not a WebSocket", () => {
    expect(WIDGET_SDK_SOURCE).toContain("/api/widget/conversations/");
    expect(WIDGET_SDK_SOURCE).toContain("/messages?key=");
    expect(WIDGET_SDK_SOURCE).toContain("setInterval");
  });

  it("dedupes polled messages against ones it already rendered itself", () => {
    expect(WIDGET_SDK_SOURCE).toContain("seenMessageIds");
  });

  it("does not start polling until the current turn's own stream has finished", () => {
    // Regression test: starting polling on "ready" (the moment the request
    // begins) raced against execution-pipeline.ts marking the assistant
    // message status='complete' in the database *before* the "done" SSE
    // event (which records the id in seenMessageIds) reaches the browser —
    // a poll landing in that window rendered the same reply a second time.
    // Polling must start only after the stream resolves, so any message it
    // finds afterward is one the widget didn't already render.
    const readyBranch = WIDGET_SDK_SOURCE.match(/event\.type === "ready"\)\s*\{([\s\S]*?)\}\s*else/);
    expect(readyBranch).not.toBeNull();
    expect(readyBranch![1]).not.toContain("startPolling");

    const readyIndex = WIDGET_SDK_SOURCE.indexOf('event.type === "ready"');
    const doneIndex = WIDGET_SDK_SOURCE.indexOf('event.type === "done"');
    const pollStartIndex = WIDGET_SDK_SOURCE.indexOf("startPolling(elements, config);");
    expect(readyIndex).toBeGreaterThan(-1);
    expect(doneIndex).toBeGreaterThan(readyIndex);
    expect(pollStartIndex).toBeGreaterThan(doneIndex);
  });

  it("skips a poll tick while a later message's own stream is in flight", () => {
    // Regression test: startPolling() begins only after the *first*
    // message's stream resolves, but the interval it starts keeps running
    // for the rest of the session — including while a *second, third, ...*
    // message is streaming. A poll tick landing in the same window the
    // first-message fix was written for (after the DB write, before the
    // client processes "done") would render that later reply twice. The
    // interval callback must bail out early while state.sending is true.
    const intervalBody = WIDGET_SDK_SOURCE.match(
      /pollTimer = setInterval\(function \(\) \{([\s\S]*?)\}, POLL_INTERVAL_MS\)/,
    );
    expect(intervalBody).not.toBeNull();
    const guardIndex = intervalBody![1].indexOf("if (state.sending) return;");
    const urlIndex = intervalBody![1].indexOf("var url =");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(urlIndex).toBeGreaterThan(guardIndex);
  });

  it("handles the handoff event (Human Takeover) without treating it as an error", () => {
    expect(WIDGET_SDK_SOURCE).toContain('"handoff"');
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
