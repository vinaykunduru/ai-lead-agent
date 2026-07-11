import { describe, expect, it } from "vitest";
import { parseSseStream } from "./sse-parser";

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const results: string[] = [];
  for await (const payload of parseSseStream(stream)) {
    results.push(payload);
  }
  return results;
}

describe("parseSseStream", () => {
  it("yields the data payload for a single well-formed event", async () => {
    const stream = streamFromChunks(['data: {"type":"token","text":"hi"}\n\n']);
    expect(await collect(stream)).toEqual(['{"type":"token","text":"hi"}']);
  });

  it("yields multiple events in order", async () => {
    const stream = streamFromChunks(["data: one\n\n", "data: two\n\n", "data: three\n\n"]);
    expect(await collect(stream)).toEqual(["one", "two", "three"]);
  });

  it("reassembles an event split across multiple chunk boundaries", async () => {
    const stream = streamFromChunks(['data: {"type":"tok', 'en","text":"hi"}\n', "\n"]);
    expect(await collect(stream)).toEqual(['{"type":"token","text":"hi"}']);
  });

  it("ignores non-data lines (event:, id:, comments, blank lines)", async () => {
    const stream = streamFromChunks(["event: message\nid: 1\n: this is a comment\ndata: payload\n\n"]);
    expect(await collect(stream)).toEqual(["payload"]);
  });

  it("skips empty data lines", async () => {
    const stream = streamFromChunks(["data: \n\ndata: real\n\n"]);
    expect(await collect(stream)).toEqual(["real"]);
  });

  it("flushes a final data line even without a trailing newline", async () => {
    const stream = streamFromChunks(["data: unterminated"]);
    expect(await collect(stream)).toEqual(["unterminated"]);
  });

  it("handles CRLF line endings", async () => {
    const stream = streamFromChunks(["data: crlf\r\n\r\n"]);
    expect(await collect(stream)).toEqual(["crlf"]);
  });

  it("yields nothing for an empty stream", async () => {
    const stream = streamFromChunks([]);
    expect(await collect(stream)).toEqual([]);
  });
});
