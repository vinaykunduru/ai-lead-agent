-- Required for the knowledge_chunks.embedding column and similarity search.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."knowledge_collection_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."knowledge_document_status" AS ENUM('pending', 'processing', 'ready', 'failed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."knowledge_document_type" AS ENUM('pdf', 'docx', 'text', 'website');--> statement-breakpoint
CREATE TYPE "public"."knowledge_embedding_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "knowledge_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" "knowledge_collection_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"type" "knowledge_document_type" NOT NULL,
	"title" text NOT NULL,
	"source_url" text,
	"storage_path" text,
	"source_text" text,
	"checksum" text,
	"status" "knowledge_document_status" DEFAULT 'pending' NOT NULL,
	"embedding_status" "knowledge_embedding_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"language" text,
	"file_size_bytes" integer,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"char_count" integer NOT NULL,
	"token_count" integer NOT NULL,
	"language" text,
	"embedding" vector(1024) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_search_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"query" text NOT NULL,
	"top_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_collections" ADD CONSTRAINT "knowledge_collections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_collections" ADD CONSTRAINT "knowledge_collections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_collection_id_knowledge_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."knowledge_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_collection_id_knowledge_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."knowledge_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_search_logs" ADD CONSTRAINT "knowledge_search_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_search_logs" ADD CONSTRAINT "knowledge_search_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Every query against these tables filters by organization_id, either
-- explicitly in application code or implicitly via the RLS policies added
-- in the next migration — none of these are speculative.
CREATE INDEX "knowledge_collections_org_idx" ON "knowledge_collections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "knowledge_documents_org_collection_idx" ON "knowledge_documents" USING btree ("organization_id", "collection_id");--> statement-breakpoint
CREATE INDEX "knowledge_chunks_document_idx" ON "knowledge_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "knowledge_search_logs_org_created_idx" ON "knowledge_search_logs" USING btree ("organization_id", "created_at" desc);--> statement-breakpoint

-- Duplicate-upload detection (spec: "Duplicate detection"): the same file
-- content re-uploaded into the same org is rejected at the service layer
-- using this constraint, not just an application-side check.
CREATE UNIQUE INDEX "knowledge_documents_org_checksum_idx" ON "knowledge_documents" ("organization_id", "checksum") WHERE "checksum" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint

-- Semantic search (spec: "Perform semantic search") — HNSW gives the best
-- recall/performance balance for pgvector at this scale and is the
-- currently recommended index type for cosine similarity search.
CREATE INDEX "knowledge_chunks_embedding_hnsw_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);