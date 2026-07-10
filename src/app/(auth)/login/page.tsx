import { LoginForm } from "./login-form";

function sanitizeNextPath(value: string | undefined): string {
  // Only allow same-origin relative paths. Reject protocol-relative ("//evil.com")
  // and absolute URLs to prevent an open-redirect via the `next` query param.
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);

  return <LoginForm nextPath={nextPath} />;
}
