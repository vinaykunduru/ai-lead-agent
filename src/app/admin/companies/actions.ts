"use server";

import { revalidatePath } from "next/cache";
import {
  createCompany,
  createFirstOwner,
  updateCompany,
  updateCompanyStatus,
} from "@/modules/organizations/service";
import {
  createCompanySchema,
  createFirstOwnerSchema,
  updateCompanySchema,
  updateCompanyStatusSchema,
} from "@/modules/organizations/validation";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCompanyAction(
  input: unknown,
): Promise<ActionResult & { organizationId?: string }> {
  const parsed = createCompanySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const result = await createCompany(parsed.data);
  if (!result.ok) {
    return {
      ok: false,
      error: result.error === "slug_taken" ? "That slug is already in use." : "Could not create company.",
    };
  }

  revalidatePath("/admin/companies");
  return { ok: true, organizationId: result.data.id };
}

export async function updateCompanyAction(input: unknown): Promise<ActionResult> {
  const parsed = updateCompanySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const org = await updateCompany(parsed.data);
  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${org.id}`);
  return { ok: true };
}

export async function updateCompanyStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = updateCompanyStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const org = await updateCompanyStatus(parsed.data);
  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${org.id}`);
  return { ok: true };
}

export async function createFirstOwnerAction(input: unknown): Promise<ActionResult> {
  const parsed = createFirstOwnerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const result = await createFirstOwner(parsed.data);
  if (!result.ok) {
    const messages: Record<string, string> = {
      already_has_owner: "This company already has a user.",
      company_suspended: "Reactivate this company before inviting a user.",
      invite_failed: result.message ?? "Could not send the invite email.",
    };
    return { ok: false, error: messages[result.error] };
  }

  revalidatePath(`/admin/companies/${parsed.data.organizationId}`);
  return { ok: true };
}
