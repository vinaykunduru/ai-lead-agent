CREATE TYPE "public"."analytics_alert_metric" AS ENUM('failure_rate', 'avg_latency_ms', 'no_match_rate', 'escalation_rate', 'bounce_rate');--> statement-breakpoint
CREATE TYPE "public"."analytics_alert_operator" AS ENUM('gt', 'gte', 'lt', 'lte');--> statement-breakpoint
CREATE TABLE "analytics_alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"metric" "analytics_alert_metric" NOT NULL,
	"operator" "analytics_alert_operator" NOT NULL,
	"threshold" numeric(12, 4) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"cards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_preferences_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "analytics_alert_rules" ADD CONSTRAINT "analytics_alert_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_alert_rules" ADD CONSTRAINT "analytics_alert_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_alert_rules_org_idx" ON "analytics_alert_rules" USING btree ("organization_id");