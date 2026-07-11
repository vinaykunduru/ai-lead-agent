import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { widgets } from "./widgets";

export const widgetLauncherPositionEnum = pgEnum("widget_launcher_position", [
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
]);

export const widgetColorSchemeEnum = pgEnum("widget_color_scheme", ["light", "dark", "auto"]);

/** One row per widget — Appearance configuration. */
export const widgetThemes = pgTable("widget_themes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  widgetId: uuid("widget_id")
    .notNull()
    .unique()
    .references(() => widgets.id, { onDelete: "cascade" }),
  primaryColor: text("primary_color").notNull().default("#4F46E5"),
  accentColor: text("accent_color").notNull().default("#22C55E"),
  launcherPosition: widgetLauncherPositionEnum("launcher_position").notNull().default("bottom-right"),
  launcherIcon: text("launcher_icon"),
  borderRadius: integer("border_radius").notNull().default(16),
  colorScheme: widgetColorSchemeEnum("color_scheme").notNull().default("auto"),
  font: text("font").notNull().default("system-ui"),
  logoUrl: text("logo_url"),
  avatarUrl: text("avatar_url"),
  widgetWidth: integer("widget_width").notNull().default(380),
  widgetHeight: integer("widget_height").notNull().default(600),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WidgetTheme = typeof widgetThemes.$inferSelect;
export type NewWidgetTheme = typeof widgetThemes.$inferInsert;
