/**
 * Reads a fetch Response body as an SSE (`text/event-stream`) byte stream
 * and yields each event's raw `data:` payload as a string, buffering across
 * chunk boundaries. Shared by every providers/ai/*.ts implementation — all
 * four vendor streaming APIs (Anthropic, OpenAI, Gemini with `alt=sse`, and
 * any OpenAI-compatible Llama host) use this same wire-level framing, even
 * though each one's JSON payload shape differs; only this framing layer is
 * common, so only this layer is shared.
 *
 * Pure I/O adapter, no vendor-specific parsing — that stays in each
 * provider file, which JSON.parses the yielded payload itself.
 */
export async function* parseSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
        buffer = buffer.slice(newlineIndex + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload) yield payload;
      }
    }
    // Flush a final unterminated line, if the stream ended without a
    // trailing newline — some servers omit it on the last chunk.
    const trailing = buffer.replace(/\r$/, "");
    if (trailing.startsWith("data:")) {
      const payload = trailing.slice(5).trim();
      if (payload) yield payload;
    }
  } finally {
    reader.releaseLock();
  }
}
