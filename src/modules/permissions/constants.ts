export const PERMISSIONS = [
  "company.view",
  "company.manage",
  "users.view",
  "users.manage",
  "leads.view",
  "leads.manage",
  "conversations.view",
  "knowledge.view",
  "knowledge.manage",
  "ai_behavior.view",
  "ai_behavior.manage",
  "widget.view",
  "widget.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
