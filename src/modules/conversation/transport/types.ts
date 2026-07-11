export type PublicCitation = {
  documentTitle: string;
  chunkPreview: string;
  confidence: "high" | "medium" | "low";
};

/**
 * Every event the execution pipeline can emit — deliberately data-only, no
 * mention of SSE, WebSockets, or any wire format. `citations` are
 * public-safe summaries only (document title + a short preview, never a
 * chunk id or embedding) — the widget SDK doesn't render these yet (module
 * spec §7: "Widget decides later whether to display citations"), but the
 * event is still emitted so a future SDK version can opt in without a
 * backend change.
 */
export type ConversationStreamEvent =
  | { type: "ready"; conversationId: string; sessionId: string }
  | { type: "token"; text: string }
  | { type: "citations"; citations: PublicCitation[] }
  | { type: "done"; messageId: string; promptTokens: number; completionTokens: number }
  | { type: "error"; message: string };

/**
 * The transport abstraction (module spec §9): the execution pipeline only
 * ever calls `send`/`close` on this interface and never knows whether
 * events are being framed as SSE, a WebSocket message, or anything else.
 * Swapping transports later (WebSocket, a realtime provider, voice) means
 * writing a new implementation of this interface, not touching
 * modules/conversation/execution-pipeline.ts.
 */
export interface ConversationTransport {
  send(event: ConversationStreamEvent): void;
  close(): void;
}
