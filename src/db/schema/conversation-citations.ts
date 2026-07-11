import { pgEnum, pgTable, real, timestamp, uuid } from "drizzle-orm/pg-core";
import { conversationMessages } from "./conversation-messages";
import { conversations } from "./conversations";
import { knowledgeChunks } from "./knowledge-chunks";
import { knowledgeDocuments } from "./knowledge-documents";
import { organizations } from "./organizations";

export const citationConfidenceEnum = pgEnum("citation_confidence", ["high", "medium", "low"]);

/**
 * Which knowledge chunks informed a given assistant message, and how
 * confident the retrieval was — internal references only (chunk id,
 * document id, similarity score). The widget SDK does not render these
 * yet; a future phase decides whether/how to surface them to visitors
 * (module spec §7: "Widget decides later whether to display citations").
 * `confidence` is a coarse bucket derived from `similarity` at write time
 * (see modules/conversation/citations.ts) purely for at-a-glance display in
 * the Conversation Inspector — the real signal is always `similarity`.
 */
export const conversationCitations = pgTable("conversation_citations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  messageId: uuid("message_id")
    .notNull()
    .references(() => conversationMessages.id, { onDelete: "cascade" }),
  chunkId: uuid("chunk_id")
    .notNull()
    .references(() => knowledgeChunks.id, { onDelete: "cascade" }),
  documentId: uuid("document_id")
    .notNull()
    .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
  similarity: real("similarity").notNull(),
  confidence: citationConfidenceEnum("confidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConversationCitation = typeof conversationCitations.$inferSelect;
export type NewConversationCitation = typeof conversationCitations.$inferInsert;
