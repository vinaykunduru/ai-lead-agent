import { describe, expect, it } from "vitest";
import { confidenceFromSimilarity } from "./citations";

describe("confidenceFromSimilarity", () => {
  it("buckets high similarity as high confidence", () => {
    expect(confidenceFromSimilarity(0.9)).toBe("high");
    expect(confidenceFromSimilarity(0.75)).toBe("high");
  });

  it("buckets mid-range similarity as medium confidence", () => {
    expect(confidenceFromSimilarity(0.6)).toBe("medium");
    expect(confidenceFromSimilarity(0.55)).toBe("medium");
  });

  it("buckets low similarity as low confidence", () => {
    expect(confidenceFromSimilarity(0.3)).toBe("low");
    expect(confidenceFromSimilarity(0)).toBe("low");
  });
});
