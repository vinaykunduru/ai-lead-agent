/**
 * Pure — no I/O, no env access (the caller passes the app's public base
 * URL) — so it's directly unit-testable. The snippet exposes only the
 * public widget key, never an internal id, matching CLAUDE.md §4: "The
 * embed snippet exposes only a public widget key."
 */
export function generateInstallationSnippet(publicKey: string, appBaseUrl: string): string {
  const sdkUrl = new URL("/api/widget/sdk.js", appBaseUrl).toString();
  return [
    `<script src="${sdkUrl}" data-widget-key="${publicKey}" async></script>`,
    `<div id="ai-widget"></div>`,
  ].join("\n");
}
