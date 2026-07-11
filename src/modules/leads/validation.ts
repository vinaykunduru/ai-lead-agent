import { z } from "zod";

export const LEAD_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export const leadIdSchema = z.object({ leadId: z.string().uuid() });
export type LeadIdInput = z.infer<typeof leadIdSchema>;

export const createLeadSchema = z.object({
  name: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  company: z.string().trim().max(200).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  source: z.string().trim().min(1).max(50).optional(),
  widgetId: z.string().uuid().nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  stageId: z.string().uuid().optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = z.object({
  name: z.string().trim().max(200).nullable().optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  company: z.string().trim().max(200).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  scoreAdjustment: z.number().int().min(-30).max(30).optional(),
});
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const changeStageSchema = z.object({ stageId: z.string().uuid() });
export type ChangeStageInput = z.infer<typeof changeStageSchema>;

export const assignLeadSchema = z.object({ userId: z.string().uuid().nullable() });
export type AssignLeadInput = z.infer<typeof assignLeadSchema>;

export const createStageSchema = z.object({ name: z.string().trim().min(1).max(60) });
export type CreateStageInput = z.infer<typeof createStageSchema>;

const stageOrderEntrySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60),
  isWon: z.boolean().default(false),
  isLost: z.boolean().default(false),
});
export const updateStagesSchema = z.object({ stages: z.array(stageOrderEntrySchema).min(1).max(30) });
export type UpdateStagesInput = z.infer<typeof updateStagesSchema>;

export const addTagSchema = z.object({ tag: z.string().trim().min(1).max(40) });
export type AddTagInput = z.infer<typeof addTagSchema>;

export const addNoteSchema = z.object({ content: z.string().trim().min(1).max(5000) });
export type AddNoteInput = z.infer<typeof addNoteSchema>;

export const leadSearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  stageId: z.string().uuid().optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
  assignedUserId: z.string().uuid().optional(),
  source: z.string().trim().max(50).optional(),
  widgetId: z.string().uuid().optional(),
  tag: z.string().trim().max(40).optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type LeadSearchQuery = z.infer<typeof leadSearchQuerySchema>;

export const replySchema = z.object({ content: z.string().trim().min(1).max(4000) });
export type ReplyInput = z.infer<typeof replySchema>;

export const INBOX_VIEWS = [
  "all",
  "assigned_to_me",
  "unassigned",
  "unread",
  "needs_reply",
  "escalated",
  "closed",
] as const;
export const inboxQuerySchema = z.object({
  view: z.enum(INBOX_VIEWS).default("all"),
  widgetId: z.string().uuid().optional(),
});
export type InboxQuery = z.infer<typeof inboxQuerySchema>;
