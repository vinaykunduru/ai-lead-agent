import { countTokens } from "gpt-tokenizer";

export type TextChunk = {
  content: string;
  charCount: number;
  tokenCount: number;
};

// Target ~300-400 tokens per chunk (a reasonable retrieval granularity),
// with a fixed overlap so context isn't lost at chunk boundaries.
const TARGET_CHUNK_CHARS = 1500;
const CHUNK_OVERLAP_CHARS = 200;

/**
 * Splits normalized text into overlapping chunks, preferring paragraph
 * boundaries, falling back to sentence boundaries, then a hard character
 * cut only as a last resort (e.g. one very long line with no punctuation).
 * Pure function — no I/O, no environment dependency — fully unit-testable.
 */
export function chunkText(text: string): TextChunk[] {
  const normalized = normalizeWhitespace(text);
  if (normalized.length === 0) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const rawChunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > TARGET_CHUNK_CHARS) {
      if (current) {
        rawChunks.push(current);
        current = "";
      }
      rawChunks.push(...splitLongParagraph(paragraph));
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= TARGET_CHUNK_CHARS) {
      current = candidate;
    } else {
      if (current) rawChunks.push(current);
      current = paragraph;
    }
  }
  if (current) rawChunks.push(current);

  return applyOverlap(rawChunks)
    .filter((c) => c.trim().length > 0)
    .map((content) => ({
      content,
      charCount: content.length,
      tokenCount: countTokens(content),
    }));
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLongParagraph(paragraph: string): string[] {
  const sentences = paragraph.match(/[^.!?]+[.!?]+(\s+|$)/g) ?? [paragraph];
  const merged: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current + sentence;
    if (candidate.length > TARGET_CHUNK_CHARS && current) {
      merged.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) merged.push(current.trim());

  // A single "sentence" longer than the target (e.g. a long URL-heavy line
  // with no punctuation) still needs a hard cut.
  return merged.flatMap((chunk) => (chunk.length > TARGET_CHUNK_CHARS ? hardCut(chunk) : [chunk]));
}

function hardCut(text: string): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += TARGET_CHUNK_CHARS) {
    parts.push(text.slice(i, i + TARGET_CHUNK_CHARS));
  }
  return parts;
}

function applyOverlap(chunks: string[]): string[] {
  if (chunks.length <= 1) return chunks;
  return chunks.map((chunk, index) => {
    if (index === 0) return chunk;
    const previous = chunks[index - 1];
    const overlap = previous.slice(Math.max(0, previous.length - CHUNK_OVERLAP_CHARS));
    return `${overlap}\n\n${chunk}`;
  });
}
