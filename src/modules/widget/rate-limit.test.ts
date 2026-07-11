import { describe, expect, it } from "vitest";
import { isRateLimited } from "./rate-limit";

describe("isRateLimited", () => {
  it("allows the first request from a fresh identifier", () => {
    expect(isRateLimited(`test-${crypto.randomUUID()}`)).toBe(false);
  });

  it("rate limits after exceeding the window's request budget", () => {
    const id = `test-${crypto.randomUUID()}`;
    const now = Date.now();
    let limited = false;
    for (let i = 0; i < 70; i++) {
      limited = isRateLimited(id, now) || limited;
    }
    expect(limited).toBe(true);
  });

  it("resets once the window has elapsed", () => {
    const id = `test-${crypto.randomUUID()}`;
    const now = Date.now();
    for (let i = 0; i < 70; i++) {
      isRateLimited(id, now);
    }
    expect(isRateLimited(id, now + 61_000)).toBe(false);
  });

  it("tracks distinct identifiers independently", () => {
    const now = Date.now();
    const idA = `test-a-${crypto.randomUUID()}`;
    const idB = `test-b-${crypto.randomUUID()}`;
    for (let i = 0; i < 70; i++) isRateLimited(idA, now);
    expect(isRateLimited(idB, now)).toBe(false);
  });
});
