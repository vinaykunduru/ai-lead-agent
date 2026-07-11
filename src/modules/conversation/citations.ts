import "server-only";
import { db } from "@/db/client";
import { conversationCitations } from "@/db/schema";
import type { ConversationRetrievalChunk } from "@/modules/knowledge/search-service";

/**
 * A coarse, human-readable bucket derived from the raw similarity score,
 * purely for at-a-glance display in the Conversation Inspector — the real
 * signal stored alongside it is always `similarity` itself. Thresholds are
 * a reasonable, documented starting point, not a tuned model.
 */
export function confidenceFromSimilarity(similarity: number): "high" | "medium" | "low" {
  if (similarity >= 0.75) return "high";
  if (similarity >= 0.55) return "medium";
  return "low";
}

/**
 * Records which knowledge chunks informed a given assistant message
 * (module spec §7). Service-role, called from within the conversation
 * execution pipeline — never user-facing.
 */
export async function recordCitations(
  organizationId: string,
  conversationId: string,
  messageId: string,
  chunks: ConversationRetrievalChunk[],
): Promise<void> {
  if (chunks.length === 0) return;

  await db.insert(conversationCitations).values(
    chunks.map((chunk) => ({
      organizationId,
      conversationId,
      messageId,
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      similarity: chunk.similarity,
      confidence: confidenceFromSimilarity(chunk.similarity),
    })),
  );
}
