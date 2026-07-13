import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // jsdom (modules/knowledge/extraction/website.ts, used for website-import
  // text extraction) is only actually needed by one job handler, not by
  // every /api/inngest request — website.ts loads it via a dynamic import()
  // at the point of use rather than a module-scope import, specifically so
  // this route's module graph doesn't eagerly evaluate it. Marking it
  // external here keeps Turbopack from inlining/bundling it regardless,
  // leaving it as a genuine runtime node_modules dependency. This is
  // unrelated to (and doesn't by itself fix) the ERR_REQUIRE_ESM incident —
  // see README.md's "Known dependency pins" section and the pnpm.overrides
  // entry in package.json for the actual root cause and fix
  // (html-encoding-sniffer's own dependency on ESM-only @exodus/bytes).
  serverExternalPackages: ["jsdom"],
};

// Source map upload only activates when SENTRY_AUTH_TOKEN/org/project are
// configured; without them this just skips upload silently.
export default withSentryConfig(nextConfig, {
  silent: true,
});
