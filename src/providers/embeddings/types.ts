export interface EmbeddingProvider {
  /** Batched — always prefer this over calling once per text. */
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}
