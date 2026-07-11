import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env.server", () => ({
  serverEnv: { ANTHROPIC_API_KEY: "test-anthropic-key" },
}));

function sseBody(lines: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

async function collectEvents(gen: AsyncGenerator<unknown>) {
  const events = [];
  for await (const event of gen) events.push(event);
  return events;
}

describe("claudeProvider", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it("streams tokens from content_block_delta events and reports usage from message_start/message_delta", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      sseBody([
        'data: {"type":"message_start","message":{"usage":{"input_tokens":42}}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}\n\n',
        'data: {"type":"message_delta","usage":{"output_tokens":7}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]),
    );

    const { claudeProvider } = await import("./claude");
    const events = await collectEvents(
      claudeProvider.streamChat({ systemPrompt: "You are helpful.", messages: [{ role: "user", content: "hi" }] }),
    );

    expect(events).toEqual([
      { type: "token", text: "Hello" },
      { type: "token", text: " world" },
      { type: "done", promptTokens: 42, completionTokens: 7 },
    ]);
  });

  it("yields an error event and stops on a Claude-reported error, without a done event", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      sseBody([
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"partial"}}\n\n',
        'data: {"type":"error","error":{"message":"overloaded_error"}}\n\n',
      ]),
    );

    const { claudeProvider } = await import("./claude");
    const events = await collectEvents(
      claudeProvider.streamChat({ systemPrompt: "sys", messages: [{ role: "user", content: "hi" }] }),
    );

    expect(events).toEqual([
      { type: "token", text: "partial" },
      { type: "error", message: "overloaded_error" },
    ]);
  });

  it("yields an error event on a non-OK HTTP response, without throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));

    const { claudeProvider } = await import("./claude");
    const events = await collectEvents(
      claudeProvider.streamChat({ systemPrompt: "sys", messages: [{ role: "user", content: "hi" }] }),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error" });
    expect((events[0] as { message: string }).message).toContain("429");
  });

  it("yields an error event when the network request itself throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("network down"));

    const { claudeProvider } = await import("./claude");
    const events = await collectEvents(
      claudeProvider.streamChat({ systemPrompt: "sys", messages: [{ role: "user", content: "hi" }] }),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error" });
  });

  it("reports its provider id and model", async () => {
    const { claudeProvider } = await import("./claude");
    expect(claudeProvider.id).toBe("claude");
    expect(typeof claudeProvider.model).toBe("string");
    expect(claudeProvider.model.length).toBeGreaterThan(0);
  });

  it("yields a clear error and never calls fetch when ANTHROPIC_API_KEY is unset", async () => {
    vi.doMock("@/lib/env.server", () => ({ serverEnv: { ANTHROPIC_API_KEY: undefined } }));
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const { claudeProvider } = await import("./claude");
    const events = await collectEvents(
      claudeProvider.streamChat({ systemPrompt: "sys", messages: [{ role: "user", content: "hi" }] }),
    );

    expect(events).toEqual([{ type: "error", message: expect.stringContaining("ANTHROPIC_API_KEY") }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
