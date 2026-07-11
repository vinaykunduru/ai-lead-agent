import type { StructuredPrompt } from "../prompt-generator";

const DAY_LABELS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

/**
 * Small, vendor-neutral data-shaping helpers shared across renderers (e.g.
 * "Mon–Fri 09:00–17:00 (UTC)"). This is not vendor-specific formatting —
 * every renderer still decides its own final layout/tags/tone around these
 * fragments — it just avoids each renderer re-deriving the same sentence
 * from raw fields.
 */
export function describeBusinessHours(hours: StructuredPrompt["behaviour"]["businessHours"]): string {
  if (hours.holidayMode) return "Currently in holiday mode — treat all requests as outside business hours.";
  if (hours.workingDays.length === 0) return "No working hours are configured.";
  const days = hours.workingDays.map((d) => DAY_LABELS[d] ?? d).join(", ");
  return `${days} ${hours.startTime}–${hours.endTime} (${hours.timezone})`;
}

export function describeLeadQuestion(question: StructuredPrompt["leadQualification"][number]): string {
  const requirement = question.required ? "required" : "optional";
  return `${question.label} [${question.fieldKey}] (${requirement})`;
}
