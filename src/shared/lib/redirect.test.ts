import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "./redirect";

describe("sanitizeNextPath", () => {
  it("allows a plain same-origin path", () => {
    expect(sanitizeNextPath("/app/leads")).toBe("/app/leads");
    expect(sanitizeNextPath("/app/leads?tab=won")).toBe("/app/leads?tab=won");
    expect(sanitizeNextPath("/")).toBe("/");
  });

  it("falls back to / for missing input", () => {
    expect(sanitizeNextPath(undefined)).toBe("/");
    expect(sanitizeNextPath(null)).toBe("/");
    expect(sanitizeNextPath("")).toBe("/");
  });

  it("blocks an absolute URL to another host", () => {
    expect(sanitizeNextPath("https://evil.com")).toBe("/");
    expect(sanitizeNextPath("http://evil.com/app")).toBe("/");
  });

  it("blocks a bare host with no scheme", () => {
    expect(sanitizeNextPath("evil.com")).toBe("/");
  });

  it("blocks a protocol-relative URL (//host)", () => {
    expect(sanitizeNextPath("//evil.com")).toBe("/");
    expect(sanitizeNextPath("//evil.com/app")).toBe("/");
  });

  it("blocks the backslash variant some URL parsers normalize to //", () => {
    expect(sanitizeNextPath("/\\evil.com")).toBe("/");
    expect(sanitizeNextPath("/\\\\evil.com")).toBe("/");
  });

  it("blocks a value with a leading space (defeats a naive startsWith check once concatenated elsewhere)", () => {
    expect(sanitizeNextPath(" /evil.com")).toBe("/");
    expect(sanitizeNextPath(" https://evil.com")).toBe("/");
  });

  it("blocks a javascript: URI", () => {
    expect(sanitizeNextPath("javascript:alert(1)")).toBe("/");
  });
});
