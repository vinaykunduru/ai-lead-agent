import { describe, expect, it } from "vitest";
import { appendKnowledgeContext } from "./knowledge-context";
import type { ConversationRetrievalChunk } from "@/modules/knowledge/search-service";

const FALLBACK = "I don't have that information right now — I'd be happy to connect you with our team.";

function makeChunk(overrides: Partial<ConversationRetrievalChunk> = {}): ConversationRetrievalChunk {
  return {
    chunkId: "chunk-1",
    documentId: "doc-1",
    documentTitle: "Services",
    collectionId: "col-1",
    content: "We offer branding, web design, and digital marketing.",
    similarity: 0.8,
    ...overrides,
  };
}

describe("appendKnowledgeContext", () => {
  it("appends retrieved chunk content to the base prompt", () => {
    const result = appendKnowledgeContext("BASE PROMPT", [makeChunk()], FALLBACK);
    expect(result).toContain("BASE PROMPT");
    expect(result).toContain("We offer branding, web design, and digital marketing.");
    expect(result).toContain("Services");
  });

  it("includes multiple chunks in order", () => {
    const chunks = [
      makeChunk({ chunkId: "a", content: "First fact." }),
      makeChunk({ chunkId: "b", content: "Second fact." }),
    ];
    const result = appendKnowledgeContext("BASE", chunks, FALLBACK);
    expect(result.indexOf("First fact.")).toBeLessThan(result.indexOf("Second fact."));
  });

  it("instructs the model to answer only from retrieved content, not general knowledge", () => {
    const result = appendKnowledgeContext("BASE", [makeChunk()], FALLBACK);
    expect(result).toMatch(/only this information|ONLY this information/);
    expect(result).toContain(FALLBACK);
  });

  it("when no chunks are retrieved, instructs the fallback message instead of leaving the model to guess", () => {
    const result = appendKnowledgeContext("BASE", [], FALLBACK);
    expect(result).toContain("No relevant information was found");
    expect(result).toContain(FALLBACK);
    expect(result).not.toContain("undefined");
  });

  it("always preserves the original base prompt unchanged", () => {
    const base = "IDENTITY: You are Bloom Bot.";
    const withChunks = appendKnowledgeContext(base, [makeChunk()], FALLBACK);
    const withoutChunks = appendKnowledgeContext(base, [], FALLBACK);
    expect(withChunks.startsWith(base)).toBe(true);
    expect(withoutChunks.startsWith(base)).toBe(true);
  });
});
