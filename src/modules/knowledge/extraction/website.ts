import "server-only";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_SIZE_BYTES = 5 * 1024 * 1024; // 5MB safety cap

export type WebsiteExtractionResult = {
  title: string;
  text: string;
};

const PRIVATE_HOSTNAME_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./, // link-local, incl. cloud metadata endpoints
];

/**
 * Rejects the obvious SSRF cases (literal loopback/private-IP hostnames).
 * This does NOT protect against DNS-rebinding, where a public hostname
 * resolves to a private IP at fetch time — closing that fully requires a
 * network-level control (e.g. an egress proxy/allowlist), not something
 * application code alone can guarantee. Documented limitation, not silently
 * assumed safe.
 */
function assertSafeUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http:// and https:// URLs are supported");
  }
  if (PRIVATE_HOSTNAME_PATTERNS.some((pattern) => pattern.test(url.hostname))) {
    throw new Error("This URL cannot be imported");
  }
}

/**
 * Fetches exactly one page (no crawling — spec: import ONE web page only)
 * and extracts clean readable text the same way Firefox's Reader Mode
 * does: strips scripts, styles, nav, headers, footers, and other
 * non-article chrome. jsdom does not execute embedded scripts unless
 * `runScripts: "dangerously"` is passed, which it is not — parsing
 * untrusted HTML here does not execute it.
 */
export async function extractWebsiteText(rawUrl: string): Promise<WebsiteExtractionResult> {
  const url = new URL(rawUrl);
  assertSafeUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AI-Lead-Agent-KnowledgeImport/1.0)" },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch URL (${response.status})`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      throw new Error(`URL did not return HTML content (got "${contentType || "unknown"}")`);
    }
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_HTML_SIZE_BYTES) {
      throw new Error("Page is too large to import");
    }
    html = await response.text();
    if (html.length > MAX_HTML_SIZE_BYTES) {
      throw new Error("Page is too large to import");
    }
  } finally {
    clearTimeout(timeout);
  }

  // Loaded lazily (not at module scope) so importing this file — e.g. via the
  // /api/inngest route's module graph — never pulls in jsdom's ESM-only
  // transitive dependency (html-encoding-sniffer -> @exodus/bytes) unless a
  // website-import job actually runs. Dynamic import() also uses Node's ESM
  // loader, which (unlike require()) can load that ESM-only dependency at all.
  const [{ JSDOM }, { Readability }] = await Promise.all([import("jsdom"), import("@mozilla/readability")]);

  const dom = new JSDOM(html, { url: url.toString() });
  const article = new Readability(dom.window.document).parse();

  if (!article || !article.textContent?.trim()) {
    throw new Error("Could not extract readable content from this page");
  }

  return {
    title: article.title?.trim() || url.toString(),
    text: article.textContent.trim(),
  };
}
