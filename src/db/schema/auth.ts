import { pgSchema, uuid } from "drizzle-orm/pg-core";

/**
 * Minimal reference to Supabase's managed `auth.users` table so our tables
 * can hold a real foreign key to it. We never write to this table directly —
 * Supabase Auth owns it entirely.
 */
export const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});
