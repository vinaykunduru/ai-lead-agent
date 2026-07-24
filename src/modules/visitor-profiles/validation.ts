import { z } from "zod";

/** Same free-text approach as the rest of this module's qualification
 * fields (budget/timeline/etc. are inherently variable phrasing, e.g. "2
 * lakh" or "10-15 people" — not something a strict numeric type should
 * force into a single format). */
export const updateVisitorProfileSchema = z.object({
  name: z.string().trim().max(200).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  company: z.string().trim().max(200).nullable().optional(),
  designation: z.string().trim().max(200).nullable().optional(),
  industry: z.string().trim().max(200).nullable().optional(),
  website: z.string().trim().max(300).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(120).nullable().optional(),
  interestedService: z.string().trim().max(300).nullable().optional(),
  requirement: z.string().trim().max(2000).nullable().optional(),
  budget: z.string().trim().max(200).nullable().optional(),
  timeline: z.string().trim().max(200).nullable().optional(),
  teamSize: z.string().trim().max(100).nullable().optional(),
  currentSolution: z.string().trim().max(200).nullable().optional(),
  preferredContactTime: z.string().trim().max(200).nullable().optional(),
});
export type UpdateVisitorProfileInput = z.infer<typeof updateVisitorProfileSchema>;

export const visitorProfileSearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
});
export type VisitorProfileSearchQuery = z.infer<typeof visitorProfileSearchQuerySchema>;
