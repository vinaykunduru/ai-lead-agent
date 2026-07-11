import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // "server-only" unconditionally throws (see node_modules/server-only/index.js)
      // — it only works in application code because Next.js's bundler
      // specially aliases it to a no-op on the server bundle. Vitest has no
      // such aliasing, and our integration tests legitimately import
      // server-only application code by design (db/client.ts,
      // lib/supabase/admin.ts, etc.) — see src/test/server-only-noop.ts.
      "server-only": fileURLToPath(new URL("./src/test/server-only-noop.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/websocket-polyfill.ts"],
    // The real-Supabase integration suites (src/test/integration/*) each
    // create real auth users and organizations in beforeAll. With four such
    // suites now, running them fully in parallel by default made them
    // contend for the same Supabase Auth Admin API and Postgres connection
    // at once, pushing setup past the default 10s hook timeout. Serializing
    // test files avoids that contention; the longer timeouts give real
    // network round-trips (not local unit tests) enough headroom.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
