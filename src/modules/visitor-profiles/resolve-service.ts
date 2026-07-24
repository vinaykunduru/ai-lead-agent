import "server-only";
import { and, eq, ne, or } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationSessions, visitorProfiles, type ConversationSession, type VisitorProfile } from "@/db/schema";

/**
 * Service-role only — the public widget pipeline has no company session
 * (CLAUDE.md §3.6). Every query here is manually scoped to organizationId,
 * same posture as modules/ai-behaviour/conversation-config.ts.
 */

/**
 * Every session gets a Visitor Profile immediately, even before any contact
 * info is shared — there must always be a stable id to progressively enrich
 * onto (Progressive Profile Enrichment, module spec §6), and "name" alone
 * ("Hi, I'm Rahul") can arrive before phone/email ever do. Idempotent: a
 * session that already has one just returns it.
 */
export async function ensureVisitorProfileForSession(session: ConversationSession): Promise<VisitorProfile> {
  if (session.visitorProfileId) {
    const [existing] = await db
      .select()
      .from(visitorProfiles)
      .where(eq(visitorProfiles.id, session.visitorProfileId))
      .limit(1);
    if (existing) return existing;
  }

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(visitorProfiles)
      .values({ organizationId: session.organizationId })
      .returning();
    await tx
      .update(conversationSessions)
      .set({ visitorProfileId: created.id, updatedAt: new Date() })
      .where(eq(conversationSessions.id, session.id));
    return created;
  });
}

type EnrichableFields = Partial<{
  // Identity + qualification — progressive, "never ask twice": once known,
  // a later call with the same field absent/empty never clears it.
  name: string;
  phone: string;
  email: string;
  company: string;
  designation: string;
  industry: string;
  website: string;
  city: string;
  country: string;
  interestedService: string;
  requirement: string;
  budget: string;
  timeline: string;
  teamSize: string;
  currentSolution: string;
  preferredContactTime: string;
  // AI-generated — refreshed every Stage 2 run, not "captured once". Lives
  // only here, not duplicated onto `leads` (see modules/leads/
  // qualification-service.ts, which only touches score/qualificationStatus).
  intent: string;
  sentiment: string;
  conversationSummary: string;
  nextRecommendedAction: string;
}>;

/**
 * Progressive enrichment + Visitor Recognition (module spec §6/§7) in one
 * step. Only fields actually present in `fields` are ever written — this
 * never clears a previously-known value, and the AI is told what's already
 * known precisely so it never asks for these again (see
 * modules/ai-behaviour/prompt-generator.ts's `visitor` section).
 *
 * If the incoming phone/email matches a DIFFERENT existing profile in the
 * org, that's a returning visitor: the current session is re-pointed to the
 * recognized profile (its history, not a fresh one, keeps growing) rather
 * than writing the new phone/email onto the throwaway blank profile this
 * session started with. The DB's partial unique indexes on
 * (organization_id, phone) / (organization_id, email) are what make this
 * safe under concurrent requests — a duplicate write can never silently
 * create two profiles for the same contact.
 */
export async function enrichVisitorProfile(params: {
  organizationId: string;
  sessionId: string;
  currentVisitorProfileId: string;
  fields: EnrichableFields;
}): Promise<VisitorProfile> {
  return db.transaction(async (tx) => {
    let targetProfileId = params.currentVisitorProfileId;

    if (params.fields.phone || params.fields.email) {
      const matchConditions = [];
      if (params.fields.phone) matchConditions.push(eq(visitorProfiles.phone, params.fields.phone));
      if (params.fields.email) matchConditions.push(eq(visitorProfiles.email, params.fields.email));

      const [match] = await tx
        .select()
        .from(visitorProfiles)
        .where(
          and(
            eq(visitorProfiles.organizationId, params.organizationId),
            or(...matchConditions),
            ne(visitorProfiles.id, params.currentVisitorProfileId),
          ),
        )
        .limit(1);

      if (match) {
        targetProfileId = match.id;
        await tx
          .update(conversationSessions)
          .set({ visitorProfileId: targetProfileId, updatedAt: new Date() })
          .where(eq(conversationSessions.id, params.sessionId));
      }
    }

    const cleanFields = Object.fromEntries(
      Object.entries(params.fields).filter(([, value]) => value !== undefined && value !== null && value !== ""),
    );

    if (Object.keys(cleanFields).length === 0) {
      const [row] = await tx.select().from(visitorProfiles).where(eq(visitorProfiles.id, targetProfileId)).limit(1);
      return row;
    }

    const isAiRefresh = ["intent", "sentiment", "conversationSummary", "nextRecommendedAction"].some(
      (key) => key in cleanFields,
    );
    const [updated] = await tx
      .update(visitorProfiles)
      .set({ ...cleanFields, updatedAt: new Date(), ...(isAiRefresh ? { lastExtractedAt: new Date() } : {}) })
      .where(eq(visitorProfiles.id, targetProfileId))
      .returning();
    return updated;
  });
}
