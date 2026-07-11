import "server-only";
import { createHash } from "node:crypto";
import { franc } from "franc-min";

export function computeChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Returns an ISO 639-3 code (e.g. "eng", "spa") or null if the text is too
 * short/ambiguous to classify confidently. Best-effort only — shown in the
 * UI as metadata, never used for anything security- or access-sensitive.
 */
export function detectLanguage(text: string): string | null {
  const code = franc(text, { minLength: 20 });
  return code === "und" ? null : code;
}
