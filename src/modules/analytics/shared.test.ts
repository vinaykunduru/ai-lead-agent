import { describe, expect, it } from "vitest";
import { DEFAULT_LOOKBACK_DAYS, resolveDateRange } from "./shared";

describe("resolveDateRange", () => {
  it("defaults to the trailing DEFAULT_LOOKBACK_DAYS window when nothing is specified", () => {
    const { from, to } = resolveDateRange({});
    const diffDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    expect(Math.round(diffDays)).toBe(DEFAULT_LOOKBACK_DAYS);
    expect(to.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("uses an explicit `to` as the anchor instead of now", () => {
    const to = "2026-01-15T00:00:00.000Z";
    const { from, to: resolvedTo } = resolveDateRange({ to });
    expect(resolvedTo.toISOString()).toBe(to);
    expect(resolvedTo.getTime() - from.getTime()).toBe(DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  });

  it("respects both explicit `from` and `to`", () => {
    const from = "2026-01-01T00:00:00.000Z";
    const to = "2026-01-10T00:00:00.000Z";
    const resolved = resolveDateRange({ from, to });
    expect(resolved.from.toISOString()).toBe(from);
    expect(resolved.to.toISOString()).toBe(to);
  });
});
