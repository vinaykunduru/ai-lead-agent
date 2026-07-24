/**
 * Stage 1 (Immediate) extraction — module spec: "Use regex / pattern
 * matching for Phone, Email, Website. Validate immediately." Pure, no I/O,
 * so it runs synchronously in the request path with zero added latency,
 * unlike Stage 2's LLM pass. Deliberately conservative: a false negative
 * (missing a phone number) just means the AI asks again next turn, which is
 * harmless; a false positive (extracting garbage as a "phone number") would
 * get written to the Visitor Profile, so every match is bounds-checked.
 */

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{6,16}\d)/;
const WEBSITE_PATTERN = /\bhttps?:\/\/[^\s<>"')]+|\bwww\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s<>"')]*)?/i;

export function extractEmail(message: string): string | null {
  const match = message.match(EMAIL_PATTERN);
  return match ? match[0].toLowerCase() : null;
}

/** Returns digits only (plus a leading `+` if present) — a loose,
 * intentionally international-agnostic normalization, not full E.164
 * validation. 7–15 digits is the ITU E.164 length bound. */
export function extractPhone(message: string): string | null {
  const match = message.match(PHONE_PATTERN);
  if (!match) return null;
  const normalized = match[0].trim().replace(/[\s().-]/g, "");
  const digitCount = normalized.replace(/\D/g, "").length;
  if (digitCount < 7 || digitCount > 15) return null;
  return normalized;
}

export function extractWebsite(message: string): string | null {
  const match = message.match(WEBSITE_PATTERN);
  if (!match) return null;
  return /^https?:\/\//i.test(match[0]) ? match[0] : `https://${match[0]}`;
}
