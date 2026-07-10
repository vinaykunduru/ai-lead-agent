export async function register() {
  // Proxy and Route Handlers in this app run on the Node.js runtime only
  // (Next 16 no longer supports edge in proxy.ts — see CLAUDE.md §9), so
  // there is no edge instrumentation file to load here.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
}
