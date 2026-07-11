import { describe, expect, it } from "vitest";
import { isWithinBusinessHours } from "./business-hours-utils";

const BASE = {
  workingDays: ["mon", "tue", "wed", "thu", "fri"],
  startTime: "09:00",
  endTime: "17:00",
  timezone: "UTC",
  holidayMode: false,
};

describe("isWithinBusinessHours", () => {
  it("returns true for a weekday within working hours", () => {
    // Wednesday 2024-01-03 12:00 UTC
    const now = new Date("2024-01-03T12:00:00Z");
    expect(isWithinBusinessHours(BASE, now)).toBe(true);
  });

  it("returns false before the working window starts", () => {
    const now = new Date("2024-01-03T07:00:00Z");
    expect(isWithinBusinessHours(BASE, now)).toBe(false);
  });

  it("returns false after the working window ends", () => {
    const now = new Date("2024-01-03T19:00:00Z");
    expect(isWithinBusinessHours(BASE, now)).toBe(false);
  });

  it("returns false on a day not in workingDays", () => {
    // Saturday 2024-01-06
    const now = new Date("2024-01-06T12:00:00Z");
    expect(isWithinBusinessHours(BASE, now)).toBe(false);
  });

  it("returns false when holidayMode is on, even during working hours", () => {
    const now = new Date("2024-01-03T12:00:00Z");
    expect(isWithinBusinessHours({ ...BASE, holidayMode: true }, now)).toBe(false);
  });

  it("returns false when workingDays is empty", () => {
    const now = new Date("2024-01-03T12:00:00Z");
    expect(isWithinBusinessHours({ ...BASE, workingDays: [] }, now)).toBe(false);
  });

  it("falls back to UTC instead of throwing for an invalid timezone", () => {
    const now = new Date("2024-01-03T12:00:00Z");
    expect(() => isWithinBusinessHours({ ...BASE, timezone: "Not/AZone" }, now)).not.toThrow();
  });

  it("respects a non-UTC timezone", () => {
    // 2024-01-03T12:00:00Z is 07:00 in America/New_York — before a 09:00 start.
    const now = new Date("2024-01-03T12:00:00Z");
    expect(isWithinBusinessHours({ ...BASE, timezone: "America/New_York" }, now)).toBe(false);
    // 2024-01-03T15:00:00Z is 10:00 in America/New_York — within hours.
    const later = new Date("2024-01-03T15:00:00Z");
    expect(isWithinBusinessHours({ ...BASE, timezone: "America/New_York" }, later)).toBe(true);
  });
});
