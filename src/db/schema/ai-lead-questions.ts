import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const aiLeadQuestionValidationEnum = pgEnum("ai_lead_question_validation", [
  "none",
  "email",
  "phone",
  "number",
  "text",
]);

/**
 * The ordered list of qualification questions a company's AI asks visitors
 * (Name, Email, Phone, Budget, ...). `fieldKey` is a stable machine
 * identifier (e.g. "email") distinct from `label`, the company-editable
 * display text, so reordering/relabeling never breaks a stored answer's
 * association with a question.
 */
export const aiLeadQuestions = pgTable("ai_lead_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  fieldKey: text("field_key").notNull(),
  label: text("label").notNull(),
  isRequired: boolean("is_required").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  placeholder: text("placeholder"),
  validationType: aiLeadQuestionValidationEnum("validation_type").notNull().default("none"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiLeadQuestion = typeof aiLeadQuestions.$inferSelect;
export type NewAiLeadQuestion = typeof aiLeadQuestions.$inferInsert;
