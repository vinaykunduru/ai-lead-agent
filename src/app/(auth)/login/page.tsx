import { LoginForm } from "./login-form";
import { sanitizeNextPath } from "@/shared/lib/redirect";

// Fixed, curated copy keyed by a known code — never echo raw query-string
// content back to the user (avoids reflected-content and internal-error
// leakage; see CLAUDE.md §6).
const NOTICES: Record<string, string> = {
  suspended:
    "Your company's account has been suspended. Contact your account owner or our support team for help.",
  invite_invalid: "That invite link is invalid or has expired. Ask your admin to resend it.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const notice = params.notice ? NOTICES[params.notice] : undefined;

  return <LoginForm nextPath={nextPath} notice={notice} />;
}
