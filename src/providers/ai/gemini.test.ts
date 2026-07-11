import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env.server", () => ({
  serverEnv: { GEMINI_API_KEY: "test-gemini-key" },
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

describe("geminiProvider", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("streams candidate text and reports usageMetadata token counts", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      sseBody([
        'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":" world"}]}}],"usageMetadata":{"promptTokenCount":11,"candidatesTokenCount":3}}\n\n',
      ]),
    );

    const { geminiProvider } = await import("./gemini");
    const events = await collectEvents(
      geminiProvider.streamChat({ systemPrompt: "sys", messages: [{ role: "user", content: "hi" }] }),
    );

    expect(events).toEqual([
      { type: "token", text: "Hello" },
      { type: "token", text: " world" },
      { type: "done", promptTokens: 11, completionTokens: 3 },
    ]);
  });

  it("maps the 'assistant' role to Gemini's 'model' role in the request body", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(sseBody([]));
    global.fetch = fetchSpy;

    const { geminiProvider } = await import("./gemini");
    await collectEvents(
      geminiProvider.streamChat({
        systemPrompt: "sys",
        messages: [
          { role: "user", content: "hi" },
          { role: "assistant", content: "hello" },
        ],
      }),
    );

    const [, requestInit] = fetchSpy.mock.calls[0];
    const body = JSON.parse(requestInit.body as string);
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "hi" }] },
      { role: "model", parts: [{ text: "hello" }] },
    ]);
    expect(body.systemInstruction).toEqual({ parts: [{ text: "sys" }] });
  });

  it("yields an error event when Gemini's payload includes an error field", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      sseBody(['data: {"error":{"message":"quota exceeded"}}\n\n']),
    );
    const { geminiProvider } = await import("./gemini");
    const events = await collectEvents(
      geminiProvider.streamChat({ systemPrompt: "sys", messages: [{ role: "user", content: "hi" }] }),
    );
    expect(events).toEqual([{ type: "error", message: "quota exceeded" }]);
  });

  it("yields an error and never calls fetch when GEMINI_API_KEY is unset", async () => {
    vi.doMock("@/lib/env.server", () => ({ serverEnv: { GEMINI_API_KEY: undefined } }));
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const { geminiProvider } = await import("./gemini");
    const events = await collectEvents(
      geminiProvider.streamChat({ systemPrompt: "sys", messages: [{ role: "user", content: "hi" }] }),
    );

    expect(events).toEqual([{ type: "error", message: expect.stringContaining("GEMINI_API_KEY") }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
