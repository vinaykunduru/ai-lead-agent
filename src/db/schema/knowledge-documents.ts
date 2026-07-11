import { integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { knowledgeCollections } from "./knowledge-collections";
import { organizations } from "./organizations";

export const knowledgeDocumentTypeEnum = pgEnum("knowledge_document_type", [
  "pdf",
  "docx",
  "text",
  "website",
]);

// Overall document lifecycle. "archived" here means the document itself was
// archived (independent of its collection's archive state).
export const knowledgeDocumentStatusEnum = pgEnum("knowledge_document_status", [
  "pending",
  "processing",
  "ready",
  "failed",
  "archived",
]);

// A finer-grained sub-status specifically for the embedding step, distinct
// from the overall `status`: a document can be status='failed' with
// embeddingStatus='pending' (text extraction never got far enough to try
// embedding) vs status='failed' with embeddingStatus='failed' (extraction
// succeeded, embedding generation specifically failed).
export const knowledgeEmbeddingStatusEnum = pgEnum("knowledge_embedding_status", [
  "pending",
  "processing",
  "ready",
  "failed",
]);

export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  collectionId: uuid("collection_id")
    .notNull()
    .references(() => knowledgeCollections.id, { onDelete: "cascade" }),
  type: knowledgeDocumentTypeEnum("type").notNull(),
  title: text("title").notNull(),
  // Populated depending on `type`: website -> sourceUrl, pdf/docx ->
  // storagePath (+ checksum for duplicate detection), text -> sourceText.
  sourceUrl: text("source_url"),
  storagePath: text("storage_path"),
  sourceText: text("source_text"),
  checksum: text("checksum"),
  status: knowledgeDocumentStatusEnum("status").notNull().default("pending"),
  embeddingStatus: knowledgeEmbeddingStatusEnum("embedding_status").notNull().default("pending"),
  // Safe, short diagnostic message only (e.g. "Unsupported PDF encoding") —
  // never a raw stack trace or document content. Shown in the UI so the
  // company user knows why processing failed.
  errorMessage: text("error_message"),
  language: text("language"),
  fileSizeBytes: integer("file_size_bytes"),
  chunkCount: integer("chunk_count").notNull().default(0),
  tokenCount: integer("token_count").notNull().default(0),
  metadata: jsonb("metadata").notNull().default({}),
  uploadedBy: uuid("uploaded_by").references(() => authUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type NewKnowledgeDocument = typeof knowledgeDocuments.$inferInsert;
