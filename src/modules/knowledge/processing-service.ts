import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { knowledgeChunks, knowledgeDocuments, type KnowledgeDocument } from "@/db/schema";
import { embeddingProvider } from "@/providers/embeddings";
import { storageProvider } from "@/providers/storage";
import { chunkText } from "./chunk-service";
import { extractDocxText, extractPdfText, extractWebsiteText } from "./extraction";
import { detectLanguage } from "./utils";

/**
 * This is the entire pipeline from the spec's workflow diagram (Extract ->
 * Normalize -> Chunk -> Generate Embeddings -> Store pgvector -> Ready),
 * run by a background job worker — see modules/knowledge/jobs.ts and
 * CLAUDE.md §3.6 ("background job workers" is one of the four documented
 * service-role exceptions, which is why this file uses `db` directly
 * instead of withRlsContext: there is no user session in a job). Exported
 * as a plain function, not an Inngest step, specifically so it stays
 * directly unit/integration-testable without needing live Inngest
 * infrastructure.
 */
export async function processDocument(documentId: string): Promise<void> {
  const [document] = await db
    .select()
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.id, documentId))
    .limit(1);

  if (!document) {
    throw new Error(`Document ${documentId} not found`);
  }
  if (document.deletedAt) {
    return;
  }

  await db
    .update(knowledgeDocuments)
    .set({ status: "processing", embeddingStatus: "pending", errorMessage: null, updatedAt: new Date() })
    .where(eq(knowledgeDocuments.id, documentId));

  let rawText: string;
  try {
    rawText = await extractDocumentText(document);
  } catch (error) {
    await markFailed(documentId, error, "extraction");
    return;
  }

  if (!rawText.trim()) {
    await markFailed(documentId, new Error("No readable text found in this document"), "extraction");
    return;
  }

  const language = detectLanguage(rawText);
  const chunks = chunkText(rawText);

  if (chunks.length === 0) {
    await markFailed(documentId, new Error("No content to index after processing"), "extraction");
    return;
  }

  await db
    .update(knowledgeDocuments)
    .set({ embeddingStatus: "processing", updatedAt: new Date() })
    .where(eq(knowledgeDocuments.id, documentId));

  let embeddings: number[][];
  try {
    embeddings = await embeddingProvider.generateEmbeddings(chunks.map((c) => c.content));
  } catch (error) {
    await markFailed(documentId, error, "embedding");
    return;
  }

  // Delete-old / insert-new / mark-ready happen in one transaction — the
  // spec's "Replace atomically" requirement for reprocessing, and it's the
  // same code path for a first-time process (delete is just a no-op then).
  await db.transaction(async (tx) => {
    await tx.delete(knowledgeChunks).where(eq(knowledgeChunks.documentId, documentId));

    await tx.insert(knowledgeChunks).values(
      chunks.map((chunk, index) => ({
        organizationId: document.organizationId,
        collectionId: document.collectionId,
        documentId,
        chunkIndex: index,
        content: chunk.content,
        charCount: chunk.charCount,
        tokenCount: chunk.tokenCount,
        language,
        embedding: embeddings[index],
      })),
    );

    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
    await tx
      .update(knowledgeDocuments)
      .set({
        status: "ready",
        embeddingStatus: "ready",
        language,
        chunkCount: chunks.length,
        tokenCount: totalTokens,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(knowledgeDocuments.id, documentId));
  });
}

async function extractDocumentText(document: KnowledgeDocument): Promise<string> {
  switch (document.type) {
    case "text": {
      if (!document.sourceText) throw new Error("Missing source text");
      return document.sourceText;
    }
    case "website": {
      if (!document.sourceUrl) throw new Error("Missing source URL");
      const { text } = await extractWebsiteText(document.sourceUrl);
      return text;
    }
    case "pdf": {
      if (!document.storagePath) throw new Error("Missing storage path");
      const buffer = await storageProvider.download(document.storagePath);
      return extractPdfText(buffer);
    }
    case "docx": {
      if (!document.storagePath) throw new Error("Missing storage path");
      const buffer = await storageProvider.download(document.storagePath);
      return extractDocxText(buffer);
    }
    default: {
      const exhaustiveCheck: never = document.type;
      throw new Error(`Unsupported document type: ${exhaustiveCheck}`);
    }
  }
}

/** Safe, short diagnostic message only — see knowledge-documents.ts's errorMessage column comment. */
async function markFailed(
  documentId: string,
  error: unknown,
  stage: "extraction" | "embedding",
): Promise<void> {
  const message = error instanceof Error ? error.message : "Processing failed";
  await db
    .update(knowledgeDocuments)
    .set({
      status: "failed",
      embeddingStatus: stage === "embedding" ? "failed" : "pending",
      errorMessage: message.slice(0, 500),
      updatedAt: new Date(),
    })
    .where(eq(knowledgeDocuments.id, documentId));
}
