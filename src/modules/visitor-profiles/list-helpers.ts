import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { RlsDb } from "@/db/client";
import { conversations, conversationSessions, leads, type Lead } from "@/db/schema";

export type LeadSummary = { score: number; qualificationStatus: Lead["qualificationStatus"] };

/**
 * Most-recently-active lead per visitor profile, for list screens (module
 * spec: Conversations/Inbox lists show Lead Score alongside the visitor).
 * Same "latest, not necessarily active" semantics as
 * modules/visitor-profiles/service.ts's getVisitorContextForConversation —
 * batched here rather than N+1 queried per row.
 */
export async function getLeadSummariesByVisitorProfileId(
  tx: RlsDb,
  organizationId: string,
  visitorProfileIds: readonly string[],
): Promise<Map<string, LeadSummary>> {
  const summaries = new Map<string, LeadSummary>();
  if (visitorProfileIds.length === 0) return summaries;

  const rows = await tx
    .select({ visitorProfileId: leads.visitorProfileId, score: leads.score, qualificationStatus: leads.qualificationStatus })
    .from(leads)
    .where(and(eq(leads.organizationId, organizationId), inArray(leads.visitorProfileId, [...visitorProfileIds])))
    .orderBy(desc(leads.lastActivityAt));

  for (const row of rows) {
    if (!row.visitorProfileId || summaries.has(row.visitorProfileId)) continue;
    summaries.set(row.visitorProfileId, { score: row.score, qualificationStatus: row.qualificationStatus });
  }
  return summaries;
}

/**
 * Total conversations per visitor profile — the "multiple conversations,
 * one visitor" count for the Leads list (module spec: Conversation Count
 * column), derived the same way as
 * modules/visitor-profiles/service.ts's listVisitorProfileConversations but
 * batched to a single grouped count instead of N per-row queries.
 */
export async function getConversationCountsByVisitorProfileId(
  tx: RlsDb,
  organizationId: string,
  visitorProfileIds: readonly string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (visitorProfileIds.length === 0) return counts;

  const rows = await tx
    .select({ visitorProfileId: conversationSessions.visitorProfileId, count: sql<number>`count(*)::int` })
    .from(conversations)
    .innerJoin(conversationSessions, eq(conversationSessions.id, conversations.sessionId))
    .where(
      and(
        eq(conversations.organizationId, organizationId),
        inArray(conversationSessions.visitorProfileId, [...visitorProfileIds]),
      ),
    )
    .groupBy(conversationSessions.visitorProfileId);

  for (const row of rows) {
    if (!row.visitorProfileId) continue;
    counts.set(row.visitorProfileId, row.count);
  }
  return counts;
}
