import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenAiCompatibleProvider } from "./openai-compatible";

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

// This one factory backs both providers/ai/openai.ts and providers/ai/llama.ts
// (any OpenAI-compatible chat-completions host) — tested directly here so
// both call sites are covered by a single, focused suite rather than two
// near-duplicate ones.
describe("createOpenAiCompatibleProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const baseConfig = {
    id: "openai" as const,
    apiUrl: "https://example.test/v1/chat/completions",
    apiKey: "test-key",
    model: "test-model",
    missingKeyMessage: "not configured",
  };

  it("streams delta.content tokens and reports usage from the final chunk", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      sseBody([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" there"}}]}\n\n',
        'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":10,"completion_tokens":2}}\n\n',
        "data: [DONE]\n\n",
      ]),
    );

    const provider = createOpenAiCompatibleProvider(baseConfig);
    const events = await collectEvents(
      provider.streamChat({ systemPrompt: "sys", messages: [{ role: "user", content: "hi" }] }),
    );

    expect(events).toEqual([
      { type: "token", text: "Hello" },
      { type: "token", text: " there" },
      { type: "done", promptTokens: 10, completionTokens: 2 },
    ]);
  });

  it("stops at the [DONE] sentinel without treating it as a JSON payload", async () => {
    global.fetch = vi.fn().mockResolvedValue(sseBody(["data: [DONE]\n\n"]));
    const provider = createOpenAiCompatibleProvider(baseConfig);
    const events = await collectEvents(
      provider.streamChat({ systemPrompt: "sys", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(events).toEqual([{ type: "done", promptTokens: 0, completionTokens: 0 }]);
  });

  it("yields an error and never calls fetch when apiKey is missing", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    const provider = createOpenAiCompatibleProvider({ ...baseConfig, apiKey: undefined });
    const events = await collectEvents(
      provider.streamChat({ systemPrompt: "sys", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(events).toEqual([{ type: "error", message: "not configured" }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("yields an error and never calls fetch when apiUrl is missing (e.g. Llama host not configured)", async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;
    const provider = createOpenAiCompatibleProvider({ ...baseConfig, apiUrl: "" });
    const events = await collectEvents(
      provider.streamChat({ systemPrompt: "sys", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(events).toEqual([{ type: "error", message: "not configured" }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("yields an error event on a non-OK HTTP response", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }));
    const provider = createOpenAiCompatibleProvider(baseConfig);
    const events = await collectEvents(
      provider.streamChat({ systemPrompt: "sys", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error" });
  });

  it("skips malformed JSON payloads instead of throwing", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      sseBody(["data: not-json\n\n", 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n']),
    );
    const provider = createOpenAiCompatibleProvider(baseConfig);
    const events = await collectEvents(
      provider.streamChat({ systemPrompt: "sys", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(events).toContainEqual({ type: "token", text: "ok" });
  });
});
