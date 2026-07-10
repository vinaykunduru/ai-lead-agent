"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCompanySession } from "@/lib/auth/session";
import { recordAuditLog } from "@/modules/audit/service";
import { setPasswordSchema } from "@/shared/validation/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function setPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = setPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Your invite link has expired. Ask your admin to resend it." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { ok: false, error: error.message };
  }

  // Best-effort: this is the "invitation accepted" audit event (CLAUDE.md
  // §7's "membership created" is logged at invite time in createFirstOwner;
  // this is the acceptance half). If session resolution fails for some
  // reason, don't block the user's password change over it.
  const session = await getCompanySession();
  if (session) {
    await recordAuditLog({
      organizationId: session.organizationId,
      actorUserId: user.id,
      actorType: "company_user",
      action: "user.invitation_accepted",
      resourceType: "membership",
      resourceId: user.id,
    });
  }

  return { ok: true };
}
