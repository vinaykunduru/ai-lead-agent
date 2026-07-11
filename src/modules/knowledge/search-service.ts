import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, withRlsContext } from "@/db/client";
import { knowledgeChunks, knowledgeDocuments, knowledgeSearchLogs } from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { embeddingProvider } from "@/providers/embeddings";
import type { SemanticSearchInput } from "./validation";

export type SemanticSearchResultItem = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  collectionId: string;
  chunkPreview: string;
  similarity: number;
};

export type SemanticSearchResult = {
  results: SemanticSearchResultItem[];
  responseTimeMs: number;
};

const DEFAULT_LIMIT = 10;
const PREVIEW_LENGTH = 240;

/**
 * Semantic search only — no AI-generated answer, per the module spec.
 * Returns the most relevant chunks with a similarity score, never invented
 * content. Knowledge retrieval is filtered by organization_id at the query
 * level (both by RLS and explicitly here) — see CLAUDE.md §5.
 */
export async function semanticSearch(input: SemanticSearchInput): Promise<SemanticSearchResult> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.search");

  const startedAt = Date.now();
  const [queryEmbedding] = await embeddingProvider.generateEmbeddings([input.query]);
  const limit = input.limit ?? DEFAULT_LIMIT;
  const embeddingLiteral = JSON.stringify(queryEmbedding);

  return withRlsContext(session.userId, async (tx) => {
    const similarity = sql<number>`1 - (${knowledgeChunks.embedding} <=> ${embeddingLiteral}::vector)`;

    const conditions = [
      eq(knowledgeChunks.organizationId, session.organizationId),
      eq(knowledgeDocuments.status, "ready"),
      isNull(knowledgeDocuments.deletedAt),
    ];
    if (input.collectionId) {
      conditions.push(eq(knowledgeChunks.collectionId, input.collectionId));
    }

    const rows = await tx
      .select({
        chunkId: knowledgeChunks.id,
        documentId: knowledgeChunks.documentId,
        collectionId: knowledgeChunks.collectionId,
        content: knowledgeChunks.content,
        documentTitle: knowledgeDocuments.title,
        similarity,
      })
      .from(knowledgeChunks)
      .innerJoin(knowledgeDocuments, eq(knowledgeDocuments.id, knowledgeChunks.documentId))
      .where(and(...conditions))
      .orderBy(desc(similarity))
      .limit(limit);

    const responseTimeMs = Date.now() - startedAt;

    const results: SemanticSearchResultItem[] = rows.map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      documentTitle: row.documentTitle,
      collectionId: row.collectionId,
      chunkPreview: row.content.slice(0, PREVIEW_LENGTH),
      similarity: Number(row.similarity),
    }));

    // Logged in the same RLS-scoped transaction as the search itself —
    // see knowledge_search_logs' RLS policy. Only references + scores are
    // stored, never chunk content (CLAUDE.md §6 / spec: "Do not store
    // unnecessary personal information").
    await tx.insert(knowledgeSearchLogs).values({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      query: input.query,
      topResults: results.map((r) => ({
        chunkId: r.chunkId,
        documentId: r.documentId,
        score: r.similarity,
      })),
      resultCount: results.length,
      latencyMs: responseTimeMs,
    });

    return { results, responseTimeMs };
  });
}

export type ConversationRetrievalChunk = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  collectionId: string;
  content: string;
  similarity: number;
};

const CONVERSATION_RETRIEVAL_LIMIT = 5;

/**
 * The Conversation Engine's retrieval step (module spec §3/§8) —
 * structurally similar to semanticSearch() above but deliberately a
 * separate function, not a shared abstraction over it: this one runs with
 * the service-role client (no visitor session exists — CLAUDE.md §3.6),
 * takes an explicit organizationId instead of resolving one from a company
 * session, returns full chunk content (the LLM needs the whole chunk, not
 * a 240-char preview), and never writes to knowledge_search_logs — the
 * Conversation Engine records what it retrieved via conversation_citations
 * instead (modules/conversation/citations.ts), which is the correct home
 * for "what informed this specific assistant reply," distinct from
 * knowledge_search_logs' job of logging company-admin-driven manual
 * searches from the Knowledge Base's own Search screen.
 */
export async function retrieveKnowledgeForConversation(
  organizationId: string,
  query: string,
  limit: number = CONVERSATION_RETRIEVAL_LIMIT,
): Promise<ConversationRetrievalChunk[]> {
  const [queryEmbedding] = await embeddingProvider.generateEmbeddings([query]);
  const embeddingLiteral = JSON.stringify(queryEmbedding);
  const similarity = sql<number>`1 - (${knowledgeChunks.embedding} <=> ${embeddingLiteral}::vector)`;

  const rows = await db
    .select({
      chunkId: knowledgeChunks.id,
      documentId: knowledgeChunks.documentId,
      collectionId: knowledgeChunks.collectionId,
      content: knowledgeChunks.content,
      documentTitle: knowledgeDocuments.title,
      similarity,
    })
    .from(knowledgeChunks)
    .innerJoin(knowledgeDocuments, eq(knowledgeDocuments.id, knowledgeChunks.documentId))
    .where(
      and(
        eq(knowledgeChunks.organizationId, organizationId),
        eq(knowledgeDocuments.status, "ready"),
        isNull(knowledgeDocuments.deletedAt),
      ),
    )
    .orderBy(desc(similarity))
    .limit(limit);

  return rows.map((row) => ({
    chunkId: row.chunkId,
    documentId: row.documentId,
    documentTitle: row.documentTitle,
    collectionId: row.collectionId,
    content: row.content,
    similarity: Number(row.similarity),
  }));
}
