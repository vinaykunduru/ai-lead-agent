import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk-service";

describe("chunkText", () => {
  it("returns an empty array for empty or whitespace-only input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  \t ")).toEqual([]);
  });

  it("produces a single chunk for short text, with accurate char and token counts", () => {
    const text = "This is a short paragraph about a company's return policy.";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].charCount).toBe(text.length);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it("merges short paragraphs that together stay under the target size", () => {
    const paragraphs = ["First short paragraph.", "Second short paragraph.", "Third short paragraph."];
    const chunks = chunkText(paragraphs.join("\n\n"));
    expect(chunks).toHaveLength(1);
    for (const paragraph of paragraphs) {
      expect(chunks[0].content).toContain(paragraph);
    }
  });

  it("preserves paragraph ordering across chunk boundaries", () => {
    // Each paragraph is long enough on its own that pairs of them don't fit
    // in one 1500-char chunk, forcing a split between paragraph 2 and 3.
    const paragraph = (marker: string) => `${marker} ${"lorem ipsum dolor sit amet ".repeat(30)}`;
    const p1 = paragraph("PARA_ONE");
    const p2 = paragraph("PARA_TWO");
    const p3 = paragraph("PARA_THREE");
    const chunks = chunkText([p1, p2, p3].join("\n\n"));

    expect(chunks.length).toBeGreaterThan(1);
    const allContent = chunks.map((c) => c.content).join("\n---\n");
    const indexOne = allContent.indexOf("PARA_ONE");
    const indexTwo = allContent.indexOf("PARA_TWO");
    const indexThree = allContent.indexOf("PARA_THREE");
    expect(indexOne).toBeGreaterThanOrEqual(0);
    expect(indexTwo).toBeGreaterThan(indexOne);
    expect(indexThree).toBeGreaterThan(indexTwo);
  });

  it("applies overlap so each chunk after the first starts with the tail of the previous one", () => {
    const paragraph = (marker: string) => `${marker} ${"lorem ipsum dolor sit amet ".repeat(30)}`;
    const chunks = chunkText([paragraph("A"), paragraph("B"), paragraph("C")].join("\n\n"));
    expect(chunks.length).toBeGreaterThan(1);

    for (let i = 1; i < chunks.length; i++) {
      const previousTail = chunks[i - 1].content.slice(-50);
      expect(chunks[i].content).toContain(previousTail);
    }
  });

  it("hard-splits a single long run of text with no sentence breaks", () => {
    const longRun = "a".repeat(4000); // no punctuation, no paragraph breaks
    const chunks = chunkText(longRun);
    expect(chunks.length).toBeGreaterThan(1);
    // Every "a" from the source must still be present somewhere in the output.
    const totalContentLength = chunks.reduce((sum, c) => sum + c.content.replace(/\n\n/g, "").length, 0);
    expect(totalContentLength).toBeGreaterThanOrEqual(longRun.length);
  });

  it("keeps chunkIndex-independent ordering stable and never returns blank chunks", () => {
    const text = ["Alpha section.", "", "Beta section.", "   ", "Gamma section."].join("\n\n");
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      expect(chunk.content.trim().length).toBeGreaterThan(0);
    }
  });
});
