import { z } from "zod";

// No `.transform()` or `.default()` on these schemas: keeping the zod input
// type identical to its output type avoids a known type-inference mismatch
// between zod v4 and @hookform/resolvers' generic Resolver type. Empty
// strings for optional fields are normalized to `undefined` in the service
// layer instead (see modules/organizations/service.ts).

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug must be at least 2 characters")
  .max(63, "Slug must be at most 63 characters")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only");

const optionalUrl = z.union([z.literal(""), z.string().trim().url("Enter a valid URL")]);
const optionalText = z.string().trim().max(60);

export const createCompanySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  slug: slugSchema,
  website: optionalUrl,
  industry: optionalText,
  timezone: z.string().trim().min(1, "Timezone is required"),
});
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  website: optionalUrl,
  industry: optionalText,
  timezone: z.string().trim().min(1, "Timezone is required"),
});
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const updateCompanyStatusSchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(["trial", "active", "suspended"]),
});
export type UpdateCompanyStatusInput = z.infer<typeof updateCompanyStatusSchema>;

export const createFirstOwnerSchema = z.object({
  organizationId: z.string().uuid(),
  fullName: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});
export type CreateFirstOwnerInput = z.infer<typeof createFirstOwnerSchema>;
