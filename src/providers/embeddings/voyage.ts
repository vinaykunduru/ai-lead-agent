import "server-only";
import { serverEnv } from "@/lib/env.server";
import { EMBEDDING_DIMENSIONS } from "@/db/schema";
import type { EmbeddingProvider } from "./types";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
// 1024-dimension output, matching db/schema/knowledge-chunks.ts's
// EMBEDDING_DIMENSIONS. Changing this model requires a migration (pgvector
// column width is fixed) — see the comment there.
const VOYAGE_MODEL = "voyage-3";
// Comfortably under Voyage's documented per-request batch limit.
const MAX_BATCH_SIZE = 128;

interface VoyageEmbeddingsResponse {
  data: { embedding: number[]; index: number }[];
}

class VoyageEmbeddingProvider implements EmbeddingProvider {
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!serverEnv.VOYAGE_API_KEY) {
      throw new Error("VOYAGE_API_KEY is not configured — cannot generate embeddings.");
    }

    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE);
      const embeddings = await this.embedBatch(batch);
      results.push(...embeddings);
    }

    for (const embedding of results) {
      if (embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Voyage returned a ${embedding.length}-dimension embedding, expected ${EMBEDDING_DIMENSIONS}. Model/schema mismatch.`,
        );
      }
    }

    return results;
  }

  private async embedBatch(batch: string[]): Promise<number[][]> {
    const response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serverEnv.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        input: batch,
        model: VOYAGE_MODEL,
        input_type: "document",
        output_dimension: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Voyage embeddings request failed (${response.status}): ${body.slice(0, 300)}`);
    }

    const json = (await response.json()) as VoyageEmbeddingsResponse;
    return [...json.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}

/**
 * The only embeddings implementation business modules should import — see
 * CLAUDE.md §2 ("business modules never import a vendor SDK directly").
 * Swapping providers means changing this file only.
 */
export const embeddingProvider: EmbeddingProvider = new VoyageEmbeddingProvider();
