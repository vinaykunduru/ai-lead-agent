import { z } from "zod";

export const WIDGET_STATUSES = ["draft", "active", "disabled", "archived"] as const;
export const LAUNCHER_POSITIONS = ["bottom-right", "bottom-left", "top-right", "top-left"] as const;
export const COLOR_SCHEMES = ["light", "dark", "auto"] as const;

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DOMAIN_PATTERN =
  /^(localhost|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(:\d{1,5})?$/i;

export const widgetIdSchema = z.object({
  widgetId: z.string().uuid(),
});
export type WidgetIdInput = z.infer<typeof widgetIdSchema>;

export const createWidgetSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).nullable().optional(),
  defaultLanguage: z.string().trim().min(2).max(10).optional(),
});
export type CreateWidgetInput = z.infer<typeof createWidgetSchema>;

export const updateWidgetSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  defaultLanguage: z.string().trim().min(2).max(10).optional(),
  // Status transitions are gated by "widget.publish" at the service layer
  // (not "widget.update") — see widgets-service.ts.
  status: z.enum(WIDGET_STATUSES).optional(),
});
export type UpdateWidgetInput = z.infer<typeof updateWidgetSchema>;

const domainInputSchema = z.object({
  id: z.string().uuid().optional(),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(253)
    .regex(DOMAIN_PATTERN, "Enter a bare domain, e.g. example.com or support.example.com"),
  isEnabled: z.boolean().default(true),
});

export const updateDomainsSchema = z.object({
  domains: z.array(domainInputSchema).max(20),
});
export type UpdateDomainsInput = z.infer<typeof updateDomainsSchema>;

export const updateAppearanceSchema = z.object({
  primaryColor: z.string().trim().regex(HEX_COLOR, "Enter a hex color, e.g. #4F46E5").optional(),
  accentColor: z.string().trim().regex(HEX_COLOR, "Enter a hex color, e.g. #22C55E").optional(),
  launcherPosition: z.enum(LAUNCHER_POSITIONS).optional(),
  launcherIcon: z.string().trim().max(200).nullable().optional(),
  borderRadius: z.number().int().min(0).max(48).optional(),
  colorScheme: z.enum(COLOR_SCHEMES).optional(),
  font: z.string().trim().min(1).max(100).optional(),
  // An empty string means "clear this field" from a plain text input — not
  // a validation failure. `.refine()` (not `.transform()`, per CLAUDE.md's
  // zod/zodResolver compatibility note) only rejects a *non-empty* string
  // that isn't a valid URL.
  logoUrl: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .refine((value) => !value || z.string().url().safeParse(value).success, "Enter a valid URL"),
  avatarUrl: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .refine((value) => !value || z.string().url().safeParse(value).success, "Enter a valid URL"),
  widgetWidth: z.number().int().min(280).max(600).optional(),
  widgetHeight: z.number().int().min(400).max(900).optional(),
});
export type UpdateAppearanceInput = z.infer<typeof updateAppearanceSchema>;

export const updateBehaviourSchema = z.object({
  welcomeMessage: z.string().trim().max(500).nullable().optional(),
  suggestedQuestions: z.array(z.string().trim().min(1).max(150)).max(10).optional(),
  showTypingIndicator: z.boolean().optional(),
  showBranding: z.boolean().optional(),
  offlineMessage: z.string().trim().max(500).nullable().optional(),
  showTimestamp: z.boolean().optional(),
  showPoweredBy: z.boolean().optional(),
  autoOpen: z.boolean().optional(),
  autoOpenDelaySeconds: z.number().int().min(0).max(120).optional(),
  // 5 minutes to 30 days — how long the embed SDK keeps reusing one
  // conversation across page navigation/refresh before starting a fresh
  // thread. Bounds are a sanity check on the input, not a technical limit.
  sessionTimeoutMinutes: z.number().int().min(5).max(43200).optional(),
});
export type UpdateBehaviourInput = z.infer<typeof updateBehaviourSchema>;

export const publicWidgetConfigQuerySchema = z.object({
  key: z.string().trim().min(1).max(200),
});
export type PublicWidgetConfigQuery = z.infer<typeof publicWidgetConfigQuerySchema>;
