CREATE TYPE "public"."lead_qualification_status" AS ENUM('cold', 'warm', 'hot');--> statement-breakpoint
CREATE TABLE "visitor_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text,
	"phone" text,
	"email" text,
	"company" text,
	"designation" text,
	"industry" text,
	"website" text,
	"city" text,
	"country" text,
	"interested_service" text,
	"requirement" text,
	"budget" text,
	"timeline" text,
	"team_size" text,
	"current_solution" text,
	"preferred_contact_time" text,
	"intent" text,
	"sentiment" text,
	"conversation_summary" text,
	"next_recommended_action" text,
	"last_extracted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD COLUMN "visitor_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "visitor_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "qualification_status" "lead_qualification_status";--> statement-breakpoint
ALTER TABLE "visitor_profiles" ADD CONSTRAINT "visitor_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_visitor_profile_id_visitor_profiles_id_fk" FOREIGN KEY ("visitor_profile_id") REFERENCES "public"."visitor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_visitor_profile_id_visitor_profiles_id_fk" FOREIGN KEY ("visitor_profile_id") REFERENCES "public"."visitor_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- "Same phone/email -> same visitor" (Visitor Recognition, module spec §7)
-- enforced at the database layer, same partial-unique-index pattern as
-- widget_keys_one_active_per_widget (migration 0009) and
-- memberships_one_active_org_per_user (migration 0002) — reuse is a real
-- constraint here, not just an app-layer convention.
CREATE UNIQUE INDEX "visitor_profiles_org_phone_idx" ON "visitor_profiles" USING btree ("organization_id", "phone") WHERE "phone" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "visitor_profiles_org_email_idx" ON "visitor_profiles" USING btree ("organization_id", "email") WHERE "email" IS NOT NULL;--> statement-breakpoint

-- Hot-path lookups: "all visitor profiles for this org" (Leads/Customer 360
-- search), "which visitor does this session/lead belong to".
CREATE INDEX "visitor_profiles_org_idx" ON "visitor_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "conversation_sessions_visitor_profile_idx" ON "conversation_sessions" USING btree ("visitor_profile_id");--> statement-breakpoint
CREATE INDEX "leads_visitor_profile_idx" ON "leads" USING btree ("visitor_profile_id");