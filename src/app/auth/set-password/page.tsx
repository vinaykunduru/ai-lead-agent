import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { SetPasswordForm } from "./set-password-form";

export default async function SetPasswordPage() {
  // Reaching this page with no session means the invite link was invalid,
  // expired, or already used — /auth/confirm would not have redirected here
  // in that case, but this guards direct navigation too.
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login?notice=invite_invalid");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <SetPasswordForm />
      </div>
    </div>
  );
}
