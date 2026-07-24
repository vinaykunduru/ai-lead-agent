/**
 * Small helpers for the "ask a provider for strict JSON, then defensively
 * parse it" pattern used anywhere this codebase prompts a model for
 * structured output (modules/leads/ai-summary.ts, modules/conversation/
 * extraction/stage2.ts). An LLM response is untrusted input like any other
 * boundary — every value is coerced/defaulted, never trusted as-is.
 */

export function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return candidate;
  return candidate.slice(start, end + 1);
}

export function clampScore(value: unknown, min = 0, max = 10): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

export function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

/** `null` on anything that isn't a non-empty string — the common shape for
 * an optional extracted field ("use null if not mentioned, never invent"). */
export function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
