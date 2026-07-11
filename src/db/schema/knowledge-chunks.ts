import { integer, jsonb, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";
import { knowledgeCollections } from "./knowledge-collections";
import { knowledgeDocuments } from "./knowledge-documents";
import { organizations } from "./organizations";

// Voyage AI's voyage-3 model output dimension — see providers/embeddings.
// If the embedding model ever changes to a different dimension, this
// requires a migration (the column width is fixed by pgvector).
export const EMBEDDING_DIMENSIONS = 1024;

export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  // Denormalized from the parent document for query/RLS convenience — a
  // chunk's collection never changes independently of its document's.
  collectionId: uuid("collection_id")
    .notNull()
    .references(() => knowledgeCollections.id, { onDelete: "cascade" }),
  documentId: uuid("document_id")
    .notNull()
    .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  charCount: integer("char_count").notNull(),
  tokenCount: integer("token_count").notNull(),
  language: text("language"),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KnowledgeChunk = typeof knowledgeChunks.$inferSelect;
export type NewKnowledgeChunk = typeof knowledgeChunks.$inferInsert;
