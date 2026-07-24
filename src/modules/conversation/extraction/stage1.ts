import "server-only";
import { extractEmail, extractPhone, extractWebsite } from "./patterns";
import { enrichVisitorProfile } from "@/modules/visitor-profiles/resolve-service";
import type { VisitorProfile } from "@/db/schema";

/**
 * Stage 1 (Immediate) — runs synchronously in the request path, before the
 * AI generates its reply, so: (a) validation/normalization happens this
 * turn, not next turn, and (b) the prompt built a few lines later already
 * reflects anything just captured, so the model doesn't ask again later in
 * the very same reply it's about to generate. Only handles phone/email/
 * website — the model itself extracts everything else (Stage 2).
 */
export async function runImmediateExtraction(params: {
  organizationId: string;
  sessionId: string;
  visitorProfileId: string;
  message: string;
}): Promise<VisitorProfile> {
  const phone = extractPhone(params.message);
  const email = extractEmail(params.message);
  const website = extractWebsite(params.message);

  if (!phone && !email && !website) {
    // Nothing to write — return the profile unchanged rather than issuing a
    // no-op write.
    return enrichVisitorProfile({
      organizationId: params.organizationId,
      sessionId: params.sessionId,
      currentVisitorProfileId: params.visitorProfileId,
      fields: {},
    });
  }

  return enrichVisitorProfile({
    organizationId: params.organizationId,
    sessionId: params.sessionId,
    currentVisitorProfileId: params.visitorProfileId,
    fields: {
      phone: phone ?? undefined,
      email: email ?? undefined,
      website: website ?? undefined,
    },
  });
}
