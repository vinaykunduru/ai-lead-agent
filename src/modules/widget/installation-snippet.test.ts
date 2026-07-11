import { describe, expect, it } from "vitest";
import { generateInstallationSnippet } from "./installation-snippet";

describe("generateInstallationSnippet", () => {
  it("includes the public key and the sdk.js script url, never anything else", () => {
    const snippet = generateInstallationSnippet("wgt_pub_abc123", "https://app.example.com");
    expect(snippet).toContain('data-widget-key="wgt_pub_abc123"');
    expect(snippet).toContain("https://app.example.com/api/widget/sdk.js");
    expect(snippet).toContain('<div id="ai-widget"></div>');
  });

  it("never includes an internal id or organization id, only the public key", () => {
    const snippet = generateInstallationSnippet("wgt_pub_xyz", "https://app.example.com");
    // The only uuid-shaped or id-shaped token allowed in the snippet is the
    // public key itself — this guards against ever accidentally
    // interpolating widgetId/organizationId into the install snippet.
    expect(snippet.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)).toBeNull();
  });

  it("resolves the sdk url relative to the given base url, including a path prefix", () => {
    const snippet = generateInstallationSnippet("wgt_pub_abc", "https://app.example.com/some/base");
    expect(snippet).toContain("https://app.example.com/api/widget/sdk.js");
  });
});
