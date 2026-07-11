import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./usage-service";

describe("estimateCostUsd", () => {
  it("returns 0 for 0 tokens", () => {
    expect(estimateCostUsd("claude", 0, 0)).toBe(0);
  });

  it("scales linearly with token count", () => {
    const oneK = estimateCostUsd("openai", 1000, 0);
    const twoK = estimateCostUsd("openai", 2000, 0);
    expect(twoK).toBeCloseTo(oneK * 2, 10);
  });

  it("charges a different rate for prompt vs completion tokens", () => {
    const promptOnly = estimateCostUsd("claude", 1000, 0);
    const completionOnly = estimateCostUsd("claude", 0, 1000);
    expect(promptOnly).not.toBeCloseTo(completionOnly, 5);
  });

  it("produces a positive, finite estimate for every known provider", () => {
    for (const provider of ["claude", "openai", "gemini", "llama"] as const) {
      const cost = estimateCostUsd(provider, 500, 500);
      expect(cost).toBeGreaterThan(0);
      expect(Number.isFinite(cost)).toBe(true);
    }
  });
});
