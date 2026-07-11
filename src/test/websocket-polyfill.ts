import { WebSocket } from "ws";

// The integration tests construct a Supabase client (createSupabaseAdminClient)
// purely to call REST/auth admin APIs — this app never uses Supabase
// Realtime. But @supabase/supabase-js unconditionally constructs a
// RealtimeClient in its constructor regardless of whether realtime features
// are used, and that construction throws on Node 20 (no native `WebSocket`
// global; that only landed as a stable global in Node 22). This polyfills
// just enough for client construction to succeed. Test-environment only —
// wired in via vitest.config.ts's setupFiles, never shipped to the app.
if (typeof globalThis.WebSocket === "undefined") {
  // @ts-expect-error - Node's lib.dom types expect the browser WebSocket
  // shape; the `ws` package is close enough for client construction, which
  // is all this test suite needs.
  globalThis.WebSocket = WebSocket;
}
