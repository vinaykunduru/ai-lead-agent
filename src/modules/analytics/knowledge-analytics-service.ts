import "server-only";
import { and, desc, eq, isNull, notExists, sql } from "drizzle-orm";
import type { RlsDb } from "@/db/client";
import { withRlsContext } from "@/db/client";
import { conversationCitations, conversationMessages, knowledgeDocuments, knowledgeSearchLogs } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { combine, dateRangeConditions } from "./shared";
import type { AnalyticsFilter } from "./validation";

export type DocumentUsage = { documentId: string; title: string; citationCount: number };
export type ChunkUsage = { chunkId: string; documentId: string; documentTitle: string; citationCount: number };

export type KnowledgeAnalytics = {
  mostUsedDocuments: DocumentUsage[];
  mostRetrievedChunks: ChunkUsage[];
  searchSuccessRate: number;
  noMatchQuestions: number;
  noMatchRate: number;
  unusedDocuments: DocumentUsage[];
  knowledgeCoverage: number;
};

const TOP_N = 10;

/** An assistant reply that went through the real RAG path (not the
 * business-hours-offline short-circuit) but ended up with zero
 * conversation_citations rows — the AI answered with no supporting
 * knowledge. */
async function countNoMatchReplies(
  tx: RlsDb,
  organizationId: string,
  filter: AnalyticsFilter,
): Promise<{ total: number; noMatch: number }> {
  const finishedReplyConds = combine(
    eq(conversationMessages.organizationId, organizationId),
    eq(conversationMessages.role, "assistant"),
    eq(conversationMessages.status, "complete"),
    sql`${conversationMessages.provider} is not null`,
    ...dateRangeConditions(conversationMessages.createdAt, filter),
  );

  const [[totalRow], [noMatchRow]] = await Promise.all([
    tx.select({ count: sql<number>`count(*)::int` }).from(conversationMessages).where(finishedReplyConds),
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(conversationMessages)
      .where(
        and(
          finishedReplyConds,
          notExists(
            tx
              .select({ id: conversationCitations.id })
              .from(conversationCitations)
              .where(eq(conversationCitations.messageId, conversationMessages.id)),
          ),
        ),
      ),
  ]);
  return { total: totalRow.count, noMatch: noMatchRow.count };
}

/**
 * Knowledge Analytics (module spec §5). Built entirely from
 * conversation_citations (what modules/conversation/citations.ts already
 * records per assistant reply) and knowledge_search_logs (the manual
 * Knowledge Base search screen's own log, modules/knowledge/
 * search-service.ts) — no new tracking added.
 *
 * "Unused Documents"/"Knowledge Coverage" are deliberately all-time, not
 * date-range filtered — "has this document ever been useful" is the
 * meaningful question, not "was it used in the selected window."
 */
export async function getKnowledgeAnalytics(filter: AnalyticsFilter): Promise<KnowledgeAnalytics> {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  return withRlsContext(session.userId, async (tx) => {
    const citationConds = combine(
      eq(conversationCitations.organizationId, session.organizationId),
      ...dateRangeConditions(conversationCitations.createdAt, filter),
    );

    const [documentRows, chunkRows, searchAgg, noMatchAgg, allReadyDocuments, usedDocumentIds] = await Promise.all([
      tx
        .select({
          documentId: conversationCitations.documentId,
          title: knowledgeDocuments.title,
          citationCount: sql<number>`count(*)::int`,
        })
        .from(conversationCitations)
        .innerJoin(knowledgeDocuments, eq(knowledgeDocuments.id, conversationCitations.documentId))
        .where(citationConds)
        .groupBy(conversationCitations.documentId, knowledgeDocuments.title)
        .orderBy(desc(sql`count(*)`))
        .limit(TOP_N),
      tx
        .select({
          chunkId: conversationCitations.chunkId,
          documentId: conversationCitations.documentId,
          documentTitle: knowledgeDocuments.title,
          citationCount: sql<number>`count(*)::int`,
        })
        .from(conversationCitations)
        .innerJoin(knowledgeDocuments, eq(knowledgeDocuments.id, conversationCitations.documentId))
        .where(citationConds)
        .groupBy(conversationCitations.chunkId, conversationCitations.documentId, knowledgeDocuments.title)
        .orderBy(desc(sql`count(*)`))
        .limit(TOP_N),
      tx
        .select({
          total: sql<number>`count(*)::int`,
          successful: sql<number>`count(*) filter (where ${knowledgeSearchLogs.resultCount} > 0)::int`,
        })
        .from(knowledgeSearchLogs)
        .where(
          combine(
            eq(knowledgeSearchLogs.organizationId, session.organizationId),
            ...dateRangeConditions(knowledgeSearchLogs.createdAt, filter),
          ),
        )
        .then(([row]) => row),
      countNoMatchReplies(tx, session.organizationId, filter),
      tx
        .select({ id: knowledgeDocuments.id, title: knowledgeDocuments.title })
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.organizationId, session.organizationId),
            eq(knowledgeDocuments.status, "ready"),
            isNull(knowledgeDocuments.deletedAt),
          ),
        ),
      tx
        .select({ documentId: conversationCitations.documentId })
        .from(conversationCitations)
        .where(eq(conversationCitations.organizationId, session.organizationId))
        .groupBy(conversationCitations.documentId),
    ]);

    const usedIdSet = new Set(usedDocumentIds.map((r) => r.documentId));
    const unusedDocuments: DocumentUsage[] = allReadyDocuments
      .filter((d) => !usedIdSet.has(d.id))
      .map((d) => ({ documentId: d.id, title: d.title, citationCount: 0 }));

    return {
      mostUsedDocuments: documentRows,
      mostRetrievedChunks: chunkRows,
      searchSuccessRate: searchAgg.total > 0 ? Math.round((searchAgg.successful / searchAgg.total) * 1000) / 10 : 0,
      noMatchQuestions: noMatchAgg.noMatch,
      noMatchRate: noMatchAgg.total > 0 ? Math.round((noMatchAgg.noMatch / noMatchAgg.total) * 1000) / 10 : 0,
      unusedDocuments,
      knowledgeCoverage:
        allReadyDocuments.length > 0
          ? Math.round(((allReadyDocuments.length - unusedDocuments.length) / allReadyDocuments.length) * 1000) / 10
          : 0,
    };
  });
}
