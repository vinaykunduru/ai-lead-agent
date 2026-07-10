// Test-only stand-in for the "server-only" package, aliased in via
// vitest.config.ts. The real package's index.js unconditionally throws —
// it only works inside application code because Next.js's bundler
// specially aliases it to a no-op on the server bundle (and to the real,
// throwing module on the client bundle, to enforce the boundary at build
// time). Vitest has no equivalent bundler-level aliasing, so integration
// tests that legitimately import server-only application code (db/client.ts,
// lib/supabase/admin.ts, etc.) need this replicated manually. The
// `import "server-only"` guard itself stays in every production file
// unchanged — this file never ships, it only exists for the test resolver.
export {};
