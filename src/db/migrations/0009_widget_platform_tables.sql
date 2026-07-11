CREATE TYPE "public"."widget_status" AS ENUM('draft', 'active', 'disabled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."widget_key_status" AS ENUM('active', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."widget_color_scheme" AS ENUM('light', 'dark', 'auto');--> statement-breakpoint
CREATE TYPE "public"."widget_launcher_position" AS ENUM('bottom-right', 'bottom-left', 'top-right', 'top-left');--> statement-breakpoint
CREATE TABLE "widgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "widget_status" DEFAULT 'draft' NOT NULL,
	"default_language" text DEFAULT 'en' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "widget_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"widget_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"status" "widget_key_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "widget_keys_public_key_unique" UNIQUE("public_key")
);
--> statement-breakpoint
CREATE TABLE "widget_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"widget_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "widget_themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"widget_id" uuid NOT NULL,
	"primary_color" text DEFAULT '#4F46E5' NOT NULL,
	"accent_color" text DEFAULT '#22C55E' NOT NULL,
	"launcher_position" "widget_launcher_position" DEFAULT 'bottom-right' NOT NULL,
	"launcher_icon" text,
	"border_radius" integer DEFAULT 16 NOT NULL,
	"color_scheme" "widget_color_scheme" DEFAULT 'auto' NOT NULL,
	"font" text DEFAULT 'system-ui' NOT NULL,
	"logo_url" text,
	"avatar_url" text,
	"widget_width" integer DEFAULT 380 NOT NULL,
	"widget_height" integer DEFAULT 600 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "widget_themes_widget_id_unique" UNIQUE("widget_id")
);
--> statement-breakpoint
CREATE TABLE "widget_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"widget_id" uuid NOT NULL,
	"welcome_message" text,
	"suggested_questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"show_typing_indicator" boolean DEFAULT true NOT NULL,
	"show_branding" boolean DEFAULT true NOT NULL,
	"offline_message" text,
	"show_timestamp" boolean DEFAULT true NOT NULL,
	"show_powered_by" boolean DEFAULT true NOT NULL,
	"auto_open" boolean DEFAULT false NOT NULL,
	"auto_open_delay_seconds" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "widget_settings_widget_id_unique" UNIQUE("widget_id")
);
--> statement-breakpoint
ALTER TABLE "widgets" ADD CONSTRAINT "widgets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widgets" ADD CONSTRAINT "widgets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_keys" ADD CONSTRAINT "widget_keys_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_keys" ADD CONSTRAINT "widget_keys_widget_id_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_domains" ADD CONSTRAINT "widget_domains_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_domains" ADD CONSTRAINT "widget_domains_widget_id_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_themes" ADD CONSTRAINT "widget_themes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_themes" ADD CONSTRAINT "widget_themes_widget_id_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_settings" ADD CONSTRAINT "widget_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "widget_settings" ADD CONSTRAINT "widget_settings_widget_id_widgets_id_fk" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Hot-path lookups: "all widgets for this org" and "all keys/domains for
-- this widget".
CREATE INDEX "widgets_org_idx" ON "widgets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "widget_keys_widget_idx" ON "widget_keys" USING btree ("widget_id");--> statement-breakpoint
CREATE INDEX "widget_domains_widget_idx" ON "widget_domains" USING btree ("widget_id");--> statement-breakpoint
-- Exactly one active key per widget — same partial-unique-index pattern as
-- memberships_one_active_org_per_user (migration 0002). Rotating a key is
-- "insert new active row, then update the old row to revoked" (see
-- modules/widget/keys-service.ts), so this index is what actually prevents
-- two simultaneously-active keys under a race, not just app-layer care.
CREATE UNIQUE INDEX "widget_keys_one_active_per_widget" ON "widget_keys" USING btree ("widget_id") WHERE "status" = 'active';--> statement-breakpoint
-- A widget cannot list the same domain twice.
CREATE UNIQUE INDEX "widget_domains_widget_domain_idx" ON "widget_domains" USING btree ("widget_id", "domain");