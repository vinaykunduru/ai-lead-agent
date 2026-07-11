import { describe, expect, it } from "vitest";
import { createSseResponse } from "./sse";
import type { ConversationTransport } from "./types";

async function readAllEvents(response: Response): Promise<unknown[]> {
  const text = await response.text();
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => JSON.parse(chunk.replace(/^data: /, "")));
}

describe("createSseResponse", () => {
  it("sets SSE response headers", () => {
    const controller = new AbortController();
    const response = createSseResponse(async (transport) => {
      transport.send({ type: "done", messageId: "m1", promptTokens: 0, completionTokens: 0 });
    }, controller.signal);

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toContain("no-cache");
  });

  it("frames each sent event as a single `data: <json>\\n\\n` line", async () => {
    const controller = new AbortController();
    const response = createSseResponse(async (transport) => {
      transport.send({ type: "ready", conversationId: "c1", sessionId: "s1" });
      transport.send({ type: "token", text: "hello" });
      transport.send({ type: "done", messageId: "m1", promptTokens: 1, completionTokens: 2 });
    }, controller.signal);

    const events = await readAllEvents(response);
    expect(events).toEqual([
      { type: "ready", conversationId: "c1", sessionId: "s1" },
      { type: "token", text: "hello" },
      { type: "done", messageId: "m1", promptTokens: 1, completionTokens: 2 },
    ]);
  });

  it("closes the stream automatically after the handler resolves", async () => {
    const controller = new AbortController();
    const response = createSseResponse(async (transport) => {
      transport.send({ type: "token", text: "x" });
    }, controller.signal);

    // If the stream never closed, .text() would hang past the test timeout.
    await expect(response.text()).resolves.toContain("token");
  });

  it("never forwards a raw thrown error message to the client — only the fixed generic message", async () => {
    const controller = new AbortController();
    const response = createSseResponse(async () => {
      throw new Error("column organization_id does not exist: leaked internal detail");
    }, controller.signal);

    const events = await readAllEvents(response);
    expect(events).toEqual([{ type: "error", message: "Something went wrong. Please try again." }]);
    const raw = JSON.stringify(events);
    expect(raw).not.toContain("column");
    expect(raw).not.toContain("organization_id");
  });

  it("passes the given signal through to the handler", async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const response = createSseResponse(async (transport: ConversationTransport, signal: AbortSignal) => {
      receivedSignal = signal;
      transport.send({ type: "done", messageId: "m1", promptTokens: 0, completionTokens: 0 });
    }, controller.signal);

    await response.text();
    expect(receivedSignal).toBe(controller.signal);
  });
});
