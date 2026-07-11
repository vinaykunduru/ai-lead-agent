import { integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { organizations } from "./organizations";

export const knowledgeSearchLogs = pgTable("knowledge_search_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").references(() => authUsers.id, { onDelete: "set null" }),
  query: text("query").notNull(),
  // References + scores only (chunk id, document id, similarity score) —
  // never a copy of chunk content, which would duplicate tenant data into a
  // log table with a different retention/access story.
  topResults: jsonb("top_results").notNull().default([]),
  resultCount: integer("result_count").notNull().default(0),
  latencyMs: integer("latency_ms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KnowledgeSearchLog = typeof knowledgeSearchLogs.$inferSelect;
export type NewKnowledgeSearchLog = typeof knowledgeSearchLogs.$inferInsert;
