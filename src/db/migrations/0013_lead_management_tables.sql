CREATE TYPE "public"."conversation_owner" AS ENUM('ai', 'human');--> statement-breakpoint
CREATE TYPE "public"."conversation_takeover_reason" AS ENUM('manual', 'automatic');--> statement-breakpoint
CREATE TYPE "public"."lead_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."lead_activity_type" AS ENUM('lead_created', 'lead_updated', 'stage_changed', 'assigned', 'note_added', 'tag_added', 'tag_removed', 'summary_generated', 'score_updated', 'escalated', 'takeover_started', 'takeover_ended');--> statement-breakpoint
CREATE TABLE "lead_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"widget_id" uuid,
	"conversation_id" uuid,
	"stage_id" uuid NOT NULL,
	"assigned_user_id" uuid,
	"name" text,
	"email" text,
	"phone" text,
	"company" text,
	"location" text,
	"source" text DEFAULT 'widget' NOT NULL,
	"priority" "lead_priority" DEFAULT 'medium' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"ai_summary" jsonb,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"tag" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"author_user_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"previous_assignee_id" uuid,
	"new_assignee_id" uuid,
	"changed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"previous_stage_id" uuid,
	"new_stage_id" uuid NOT NULL,
	"changed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"signals" jsonb NOT NULL,
	"total_score" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"type" "lead_activity_type" NOT NULL,
	"actor_user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "owner" "conversation_owner" DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "assigned_user_id" uuid;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "takeover_reason" "conversation_takeover_reason";--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "takeover_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "last_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lead_stages" ADD CONSTRAINT "lead_stages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_widget_id_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_id_lead_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."lead_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_tags" ADD CONSTRAINT "lead_tags_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_previous_assignee_id_users_id_fk" FOREIGN KEY ("previous_assignee_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_new_assignee_id_users_id_fk" FOREIGN KEY ("new_assignee_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_previous_stage_id_lead_stages_id_fk" FOREIGN KEY ("previous_stage_id") REFERENCES "public"."lead_stages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_new_stage_id_lead_stages_id_fk" FOREIGN KEY ("new_stage_id") REFERENCES "public"."lead_stages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_stages_org_idx" ON "lead_stages" USING btree ("organization_id", "sort_order");--> statement-breakpoint
CREATE INDEX "leads_org_created_idx" ON "leads" USING btree ("organization_id", "created_at" desc);--> statement-breakpoint
CREATE INDEX "leads_org_stage_idx" ON "leads" USING btree ("organization_id", "stage_id");--> statement-breakpoint
CREATE INDEX "leads_org_assignee_idx" ON "leads" USING btree ("organization_id", "assigned_user_id");--> statement-breakpoint
-- At most one lead per conversation — "every visitor can become a lead"
-- (singular), not multiple; also makes "does this conversation already
-- have a lead" a fast, race-safe lookup (modules/leads/auto-create.ts).
CREATE UNIQUE INDEX "leads_conversation_idx" ON "leads" USING btree ("conversation_id") WHERE "conversation_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_tags_lead_tag_idx" ON "lead_tags" USING btree ("lead_id", "tag");--> statement-breakpoint
CREATE INDEX "lead_tags_org_idx" ON "lead_tags" USING btree ("organization_id", "tag");--> statement-breakpoint
CREATE INDEX "lead_notes_lead_created_idx" ON "lead_notes" USING btree ("lead_id", "created_at");--> statement-breakpoint
CREATE INDEX "lead_assignments_lead_idx" ON "lead_assignments" USING btree ("lead_id", "created_at");--> statement-breakpoint
CREATE INDEX "lead_stage_history_lead_idx" ON "lead_stage_history" USING btree ("lead_id", "created_at");--> statement-breakpoint
CREATE INDEX "lead_scores_lead_idx" ON "lead_scores" USING btree ("lead_id", "created_at");--> statement-breakpoint
CREATE INDEX "lead_activity_lead_created_idx" ON "lead_activity" USING btree ("lead_id", "created_at" desc);--> statement-breakpoint
CREATE INDEX "conversations_org_owner_idx" ON "conversations" USING btree ("organization_id", "owner");--> statement-breakpoint
CREATE INDEX "conversations_org_assignee_idx" ON "conversations" USING btree ("organization_id", "assigned_user_id");