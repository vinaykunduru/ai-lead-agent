import type { ConversationStreamEvent, ConversationTransport } from "./types";

/**
 * The current (and only, for this milestone) transport implementation —
 * Server-Sent Events over a plain HTTP streaming Response, per module spec
 * §5 ("Do NOT implement WebSockets"). `handler` receives a
 * ConversationTransport and an AbortSignal (tied to the client's own
 * disconnect via the route's `request.signal`) and knows nothing about SSE
 * framing itself — see transport/types.ts's doc comment.
 */
export function createSseResponse(
  handler: (transport: ConversationTransport, signal: AbortSignal) => Promise<void>,
  signal: AbortSignal,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const transport: ConversationTransport = {
        send(event: ConversationStreamEvent) {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // Controller already closed (client disconnected mid-stream) —
            // nothing to do; the abort signal is the source of truth for
            // stopping upstream work, not this catch.
          }
        },
        close() {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            // Already closed by the client disconnecting — fine.
          }
        },
      };

      try {
        await handler(transport, signal);
      } catch {
        // Never forward a raw error message here — this is a public,
        // unauthenticated boundary (matching apiError()'s posture in
        // src/app/api/_lib/handle-error.ts). Every *expected* failure the
        // pipeline can hit (unknown widget, provider error) already sends
        // its own safe, specific transport error event before returning
        // normally; reaching this catch means something unexpected broke,
        // which is exactly the case that must never leak internals.
        transport.send({ type: "error", message: "Something went wrong. Please try again." });
      } finally {
        transport.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disables response buffering on nginx-fronted deployments so SSE
      // chunks actually flush immediately instead of being held back.
      "X-Accel-Buffering": "no",
    },
  });
}
