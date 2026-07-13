import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { WIDGET_SDK_SOURCE } from "./sdk-source";

/**
 * Executes the actual shipped rendering functions (extracted from the real
 * WIDGET_SDK_SOURCE string, not a hand-copied duplicate) against a real DOM
 * (linkedom) to verify the markdown-subset renderer produces correct,
 * XSS-safe output. sdk-source.test.ts only asserts on the source text
 * itself; this file actually runs the logic.
 */
function extractFunction(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`function ${name} not found in WIDGET_SDK_SOURCE`);
  let depth = 0;
  let i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(start, i + 1);
}

function loadRenderer() {
  const combined = [
    extractFunction(WIDGET_SDK_SOURCE, "isSafeUrl"),
    extractFunction(WIDGET_SDK_SOURCE, "makeLink"),
    extractFunction(WIDGET_SDK_SOURCE, "appendInline"),
    extractFunction(WIDGET_SDK_SOURCE, "renderAssistantText"),
  ].join("\n\n");

  const { document, window } = parseHTML("<html><body></body></html>", {
    location: { href: "https://customer-site.example.com/" },
  });
  const factory = new Function(
    "document",
    "window",
    combined + "\nreturn { renderAssistantText: renderAssistantText };",
  );
  const { renderAssistantText } = factory(document, window) as {
    renderAssistantText: (el: Element, text: string) => void;
  };
  return { document, renderAssistantText };
}

describe("widget SDK markdown rendering (executed against a real DOM)", () => {
  it("renders a bullet list with bold text and a markdown link as real DOM elements", () => {
    const { document, renderAssistantText } = loadRenderer();
    const container = document.createElement("span");
    renderAssistantText(
      container,
      "Services:\n- **Branding**: strategy, logo\n- **Web Dev**: sites, e-commerce\n\nSee our [portfolio](https://bloomdigital.co.in/portfolio).",
    );

    expect(container.querySelectorAll("li").length).toBe(2);
    expect(container.querySelector("strong")?.textContent).toBe("Branding");
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://bloomdigital.co.in/portfolio");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("auto-links bare https:// URLs", () => {
    const { document, renderAssistantText } = loadRenderer();
    const container = document.createElement("span");
    renderAssistantText(container, "Visit https://webpipl.com for details.");
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://webpipl.com");
  });

  it("renders a numbered list", () => {
    const { document, renderAssistantText } = loadRenderer();
    const container = document.createElement("span");
    renderAssistantText(container, "Steps:\n1. Discover\n2. Design\n3. Launch");
    expect(container.querySelector("ol")).toBeTruthy();
    expect(container.querySelectorAll("li").length).toBe(3);
  });

  it("never turns a javascript: URI into a real href", () => {
    const { document, renderAssistantText } = loadRenderer();
    const container = document.createElement("span");
    renderAssistantText(container, "Click [here](javascript:alert(1)) for a surprise.");
    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  });

  it("never parses raw HTML tags in a response as real elements (only textContent/createElement are used)", () => {
    const { document, renderAssistantText } = loadRenderer();
    const container = document.createElement("span");
    renderAssistantText(container, 'Ignore this: <img src=x onerror=alert(1)> and <script>alert(1)</script>');
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});
