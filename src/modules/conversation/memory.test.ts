import { describe, expect, it } from "vitest";
import { buildHistoryWindow, type StoredMessage } from "./memory";

function msg(role: StoredMessage["role"], content: string): StoredMessage {
  return { role, content };
}

describe("buildHistoryWindow", () => {
  it("returns an empty window for no messages", () => {
    expect(buildHistoryWindow([])).toEqual([]);
  });

  it("filters out system and tool messages, keeping only user/assistant", () => {
    const messages: StoredMessage[] = [
      msg("system", "You are a helpful assistant."),
      msg("user", "Hello"),
      msg("tool", "search result"),
      msg("assistant", "Hi there"),
    ];
    const window = buildHistoryWindow(messages);
    expect(window.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("preserves chronological order", () => {
    const messages: StoredMessage[] = [
      msg("user", "first"),
      msg("assistant", "second"),
      msg("user", "third"),
    ];
    const window = buildHistoryWindow(messages);
    expect(window.map((m) => m.content)).toEqual(["first", "second", "third"]);
  });

  it("caps the window at maxMessages, keeping the most recent ones", () => {
    const messages: StoredMessage[] = Array.from({ length: 10 }, (_, i) =>
      msg(i % 2 === 0 ? "user" : "assistant", `message ${i}`),
    );
    const window = buildHistoryWindow(messages, 100_000, 4);
    expect(window).toHaveLength(4);
    expect(window.map((m) => m.content)).toEqual(["message 6", "message 7", "message 8", "message 9"]);
  });

  it("stops adding older messages once the token budget is exhausted", () => {
    const longMessage = "word ".repeat(500); // several hundred tokens
    const messages: StoredMessage[] = [
      msg("user", longMessage),
      msg("assistant", "short reply"),
      msg("user", "short question"),
    ];
    // Budget only large enough for the most recent one or two short messages.
    const window = buildHistoryWindow(messages, 20, 100);
    expect(window[window.length - 1].content).toBe("short question");
    expect(window.some((m) => m.content === longMessage)).toBe(false);
  });

  it("always includes the most recent message even if it alone exceeds the token budget", () => {
    const longMessage = "word ".repeat(2000);
    const window = buildHistoryWindow([msg("user", longMessage)], 5, 100);
    expect(window).toHaveLength(1);
    expect(window[0].content).toBe(longMessage);
  });
});
