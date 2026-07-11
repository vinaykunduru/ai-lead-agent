import { boolean, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { organizations } from "./organizations";

export const knowledgeCollectionStatusEnum = pgEnum("knowledge_collection_status", [
  "active",
  "archived",
]);

export const knowledgeCollections = pgTable("knowledge_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Phase 1 always creates exactly one default collection per org at
  // provisioning time — see CLAUDE.md §8. Never assume 1:1 org:collection
  // elsewhere; the schema supports more.
  isDefault: boolean("is_default").notNull().default(false),
  status: knowledgeCollectionStatusEnum("status").notNull().default("active"),
  createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // Soft delete, distinct from "archived": archived collections are still
  // visible in an archived filter and can be reactivated; a deleted
  // collection is hidden everywhere. Never hard-deleted (CLAUDE.md /
  // spec: "No permanent delete by default").
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type KnowledgeCollection = typeof knowledgeCollections.$inferSelect;
export type NewKnowledgeCollection = typeof knowledgeCollections.$inferInsert;
