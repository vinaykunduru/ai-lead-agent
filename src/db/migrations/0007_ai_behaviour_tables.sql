CREATE TYPE "public"."ai_emoji_usage" AS ENUM('none', 'minimal', 'frequent');--> statement-breakpoint
CREATE TYPE "public"."ai_personality_type" AS ENUM('professional', 'friendly', 'technical', 'luxury', 'healthcare', 'legal', 'sales', 'custom');--> statement-breakpoint
CREATE TYPE "public"."ai_response_detail" AS ENUM('concise', 'balanced', 'detailed');--> statement-breakpoint
CREATE TYPE "public"."ai_lead_question_validation" AS ENUM('none', 'email', 'phone', 'number', 'text');--> statement-breakpoint
CREATE TABLE "ai_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"assistant_name" text DEFAULT 'Assistant' NOT NULL,
	"assistant_description" text,
	"company_summary" text,
	"role" text,
	"personality_type" "ai_personality_type" DEFAULT 'professional' NOT NULL,
	"custom_personality_description" text,
	"response_style" text,
	"communication_preferences" text,
	"max_response_length" integer DEFAULT 500 NOT NULL,
	"response_detail" "ai_response_detail" DEFAULT 'balanced' NOT NULL,
	"emoji_usage" "ai_emoji_usage" DEFAULT 'minimal' NOT NULL,
	"markdown_enabled" boolean DEFAULT true NOT NULL,
	"bullet_list_preference" boolean DEFAULT true NOT NULL,
	"ask_follow_up_questions" boolean DEFAULT true NOT NULL,
	"one_question_at_a_time" boolean DEFAULT true NOT NULL,
	"always_concise" boolean DEFAULT false NOT NULL,
	"primary_language" text DEFAULT 'en' NOT NULL,
	"supported_languages" jsonb DEFAULT '["en"]'::jsonb NOT NULL,
	"auto_detect_language" boolean DEFAULT true NOT NULL,
	"fallback_language" text DEFAULT 'en' NOT NULL,
	"safety_fallback_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_profiles_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "ai_business_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"text" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_lead_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"label" text NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"placeholder" text,
	"validation_type" "ai_lead_question_validation" DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_business_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"working_days" jsonb DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb NOT NULL,
	"start_time" text DEFAULT '09:00' NOT NULL,
	"end_time" text DEFAULT '17:00' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"holiday_mode" boolean DEFAULT false NOT NULL,
	"outside_hours_response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_business_hours_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "ai_handoff_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"escalation_enabled" boolean DEFAULT false NOT NULL,
	"escalation_email" text,
	"escalation_message" text,
	"manual_review_required" boolean DEFAULT false NOT NULL,
	"max_ai_attempts" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_handoff_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "ai_profiles" ADD CONSTRAINT "ai_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_business_rules" ADD CONSTRAINT "ai_business_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_lead_questions" ADD CONSTRAINT "ai_lead_questions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_business_hours" ADD CONSTRAINT "ai_business_hours_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_handoff_settings" ADD CONSTRAINT "ai_handoff_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- ai_profiles/ai_business_hours/ai_handoff_settings are one-row-per-org and
-- already have a unique index on organization_id from their UNIQUE
-- constraint above. ai_business_rules and ai_lead_questions are ordered
-- lists per org, so their hot-path lookup is "all rows for this org,
-- ordered" — index accordingly.
CREATE INDEX "ai_business_rules_org_order_idx" ON "ai_business_rules" USING btree ("organization_id", "sort_order");--> statement-breakpoint
CREATE INDEX "ai_lead_questions_org_order_idx" ON "ai_lead_questions" USING btree ("organization_id", "sort_order");