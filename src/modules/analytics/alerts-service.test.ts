import { describe, expect, it } from "vitest";
import { compare } from "./alerts-service";

describe("compare (alert threshold evaluation)", () => {
  it("gt: breaches only when strictly above the threshold", () => {
    expect(compare(10, "gt", 5)).toBe(true);
    expect(compare(5, "gt", 5)).toBe(false);
    expect(compare(4, "gt", 5)).toBe(false);
  });

  it("gte: breaches at or above the threshold", () => {
    expect(compare(5, "gte", 5)).toBe(true);
    expect(compare(4.9, "gte", 5)).toBe(false);
  });

  it("lt: breaches only when strictly below the threshold", () => {
    expect(compare(3, "lt", 5)).toBe(true);
    expect(compare(5, "lt", 5)).toBe(false);
  });

  it("lte: breaches at or below the threshold", () => {
    expect(compare(5, "lte", 5)).toBe(true);
    expect(compare(5.1, "lte", 5)).toBe(false);
  });
});
