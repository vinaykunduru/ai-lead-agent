import { z } from "zod";

export const sendMessageSchema = z.object({
  key: z.string().trim().min(1).max(200),
  // The embed SDK generates this once via crypto.randomUUID() and persists
  // it in localStorage — a stable, non-PII correlation token, never a real
  // account identifier. Validated as a UUID purely for input hygiene, not
  // because it needs to be cryptographically unguessable (it isn't a
  // credential; the public widget key + domain check are what gate access).
  visitorId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(4000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const listConversationsQuerySchema = z.object({
  widgetId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
