import { describe, expect, it } from "vitest";
import { computeChecksum, detectLanguage } from "./utils";

describe("computeChecksum", () => {
  it("is deterministic for identical content", () => {
    const a = computeChecksum(Buffer.from("hello world"));
    const b = computeChecksum(Buffer.from("hello world"));
    expect(a).toBe(b);
  });

  it("differs for different content", () => {
    const a = computeChecksum(Buffer.from("hello world"));
    const b = computeChecksum(Buffer.from("hello world!"));
    expect(a).not.toBe(b);
  });

  it("returns a 64-character hex sha256 digest", () => {
    const hash = computeChecksum(Buffer.from("some file content"));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("detectLanguage", () => {
  it("returns a non-null ISO 639-3 code for clearly-English prose", () => {
    const text =
      "The quick brown fox jumps over the lazy dog near the riverbank every single morning of the week.";
    expect(detectLanguage(text)).toBe("eng");
  });

  it("returns null for text too short to classify confidently", () => {
    expect(detectLanguage("hi")).toBeNull();
  });
});
