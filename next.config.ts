import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // jsdom (modules/knowledge/extraction/website.ts, used for website-import
  // text extraction) has a transitive dependency
  // (html-encoding-sniffer -> @exodus/bytes) that ships ESM-only. Turbopack's
  // production bundler tries to inline jsdom into whatever route imports it
  // — including /api/inngest, since that's where the knowledge-processing
  // job function lives — and its CJS `require()` shim can't load that ESM
  // module, crashing the entire route with ERR_REQUIRE_ESM before it ever
  // runs. Marking jsdom external leaves it as a genuine runtime
  // node_modules dependency instead, resolved by Node's own (correct)
  // ESM/CJS interop rather than Turbopack's bundler.
  serverExternalPackages: ["jsdom"],
};

// Source map upload only activates when SENTRY_AUTH_TOKEN/org/project are
// configured; without them this just skips upload silently.
export default withSentryConfig(nextConfig, {
  silent: true,
});
