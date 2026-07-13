import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {};

// Source map upload only activates when SENTRY_AUTH_TOKEN/org/project are
// configured; without them this just skips upload silently.
export default withSentryConfig(nextConfig, {
  silent: true,
});
