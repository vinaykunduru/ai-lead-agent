export type BusinessHoursWindow = {
  workingDays: string[];
  startTime: string;
  endTime: string;
  timezone: string;
  holidayMode: boolean;
};

/**
 * Pure, no I/O — evaluates "is it currently within business hours" for a
 * given configuration and instant. Used by the Playground preview (task
 * #10) and available for the future chat engine's "outside hours" routing.
 * Falls back to UTC if the stored timezone string is invalid rather than
 * throwing, since this only ever affects a preview/routing decision, never
 * security.
 */
export function isWithinBusinessHours(window: BusinessHoursWindow, now: Date = new Date()): boolean {
  if (window.holidayMode) return false;
  if (window.workingDays.length === 0) return false;

  let timeZone = window.timezone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    timeZone = "UTC";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value.toLowerCase().slice(0, 3);
  const hour = parts.find((p) => p.type === "hour")?.value.padStart(2, "0");
  const minute = parts.find((p) => p.type === "minute")?.value.padStart(2, "0");
  if (!weekday || !hour || !minute) return false;

  const currentTime = `${hour === "24" ? "00" : hour}:${minute}`;
  if (!window.workingDays.includes(weekday)) return false;
  return currentTime >= window.startTime && currentTime <= window.endTime;
}
