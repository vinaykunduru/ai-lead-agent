/**
 * Source for the public embed SDK, served as-is (no build step) by
 * GET /api/widget/sdk.js. Kept as a template string rather than a bundled
 * asset so it stays a single, auditable, framework-independent file — see
 * module spec §15: "framework-independent, usable on any website."
 *
 * Scope boundary (module spec): loads the widget, fetches public config,
 * renders a shell, applies the theme, and exposes an extension point for a
 * future chat engine. It never calls an AI provider, never sends/receives
 * a conversation message, and never streams anything — those belong to a
 * later phase.
 *
 * Origin validation happens server-side (GET /api/widget/config checks the
 * browser's own `Origin` header against the widget's allowed domains) —
 * the browser attaches that header to the fetch below automatically; the
 * SDK itself does not and cannot forge it.
 */
export const WIDGET_SDK_SOURCE = `(function () {
  "use strict";

  var currentScript = document.currentScript;
  if (!currentScript) return;

  var publicKey = currentScript.getAttribute("data-widget-key");
  if (!publicKey) {
    console.error("[ai-widget] Missing data-widget-key attribute on the install script tag.");
    return;
  }

  var scriptUrl = new URL(currentScript.src, window.location.href);
  var apiBase = scriptUrl.origin;

  function applyTheme(host, appearance) {
    host.style.setProperty("--ai-widget-primary", appearance.primaryColor);
    host.style.setProperty("--ai-widget-accent", appearance.accentColor);
    host.style.setProperty("--ai-widget-radius", appearance.borderRadius + "px");
    host.style.setProperty("--ai-widget-font", appearance.font);
    host.style.setProperty("--ai-widget-width", appearance.widgetWidth + "px");
    host.style.setProperty("--ai-widget-height", appearance.widgetHeight + "px");

    var position = appearance.launcherPosition || "bottom-right";
    var vertical = position.indexOf("top") === 0 ? "top" : "bottom";
    var horizontal = position.indexOf("right") !== -1 ? "right" : "left";
    host.style.position = "fixed";
    host.style[vertical] = "20px";
    host.style[horizontal] = "20px";
    host.style.zIndex = "2147483000";
  }

  function renderShell(container, config) {
    // Shadow DOM keeps the widget's styling isolated from (and immune to)
    // the host page's own CSS, in both directions — a real requirement
    // for a script embedded on arbitrary third-party sites.
    var shadow = container.attachShadow ? container.attachShadow({ mode: "open" }) : container;

    var style = document.createElement("style");
    style.textContent = [
      ":host, .ai-widget-root { font-family: var(--ai-widget-font, system-ui), sans-serif; }",
      ".ai-widget-launcher {",
      "  width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;",
      "  background: var(--ai-widget-primary); box-shadow: 0 4px 16px rgba(0,0,0,0.2);",
      "  color: #fff; font-size: 24px;",
      "}",
      ".ai-widget-panel {",
      "  display: none; position: absolute; bottom: 72px; right: 0;",
      "  width: var(--ai-widget-width, 380px); height: var(--ai-widget-height, 600px);",
      "  max-width: calc(100vw - 40px); max-height: calc(100vh - 120px);",
      "  border-radius: var(--ai-widget-radius, 16px); background: #fff;",
      "  box-shadow: 0 8px 30px rgba(0,0,0,0.25); overflow: hidden; flex-direction: column;",
      "}",
      ".ai-widget-panel.open { display: flex; }",
      ".ai-widget-header { background: var(--ai-widget-primary); color: #fff; padding: 16px; font-weight: 600; }",
      ".ai-widget-body { flex: 1; padding: 16px; overflow-y: auto; color: #111; font-size: 14px; }",
      ".ai-widget-suggested { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }",
      ".ai-widget-suggested button {",
      "  border: 1px solid var(--ai-widget-accent); color: var(--ai-widget-accent);",
      "  background: none; border-radius: 999px; padding: 6px 12px; font-size: 12px; cursor: pointer;",
      "}",
      ".ai-widget-footer { padding: 8px 16px; font-size: 11px; color: #888; text-align: center; }",
    ].join("\\n");

    var root = document.createElement("div");
    root.className = "ai-widget-root";
    root.style.position = "relative";

    var panel = document.createElement("div");
    panel.className = "ai-widget-panel";

    var header = document.createElement("div");
    header.className = "ai-widget-header";
    header.textContent = config.name;
    panel.appendChild(header);

    var body = document.createElement("div");
    body.className = "ai-widget-body";
    var welcome = document.createElement("p");
    welcome.textContent = config.behaviour.welcomeMessage || "Hi! How can we help?";
    body.appendChild(welcome);

    if (config.behaviour.suggestedQuestions && config.behaviour.suggestedQuestions.length) {
      var suggested = document.createElement("div");
      suggested.className = "ai-widget-suggested";
      config.behaviour.suggestedQuestions.forEach(function (question) {
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = question;
        // Extension point only — Phase 4 does not implement chat. A future
        // conversation-engine phase wires this click (and the panel body
        // generally) up to a real message-sending flow.
        button.addEventListener("click", function () {
          if (window.__aiWidgetOnSuggestedQuestion) {
            window.__aiWidgetOnSuggestedQuestion(question);
          }
        });
        suggested.appendChild(button);
      });
      body.appendChild(suggested);
    }
    panel.appendChild(body);

    if (config.behaviour.showPoweredBy) {
      var footer = document.createElement("div");
      footer.className = "ai-widget-footer";
      footer.textContent = "Powered by " + config.name;
      panel.appendChild(footer);
    }

    var launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "ai-widget-launcher";
    launcher.setAttribute("aria-label", "Open chat");
    launcher.textContent = "\\u{1F4AC}";
    launcher.addEventListener("click", function () {
      panel.classList.toggle("open");
    });

    root.appendChild(panel);
    root.appendChild(launcher);
    shadow.appendChild(style);
    shadow.appendChild(root);

    if (config.behaviour.autoOpen) {
      var delay = (config.behaviour.autoOpenDelaySeconds || 0) * 1000;
      setTimeout(function () {
        panel.classList.add("open");
      }, delay);
    }
  }

  function mount(config) {
    var container = document.getElementById("ai-widget");
    if (!container) {
      container = document.createElement("div");
      container.id = "ai-widget";
      document.body.appendChild(container);
    }
    applyTheme(container, config.appearance);
    renderShell(container, config);

    // Public, read-only handle for a future chat-engine phase to build on
    // — never expands to include AI calls in this phase.
    window.AIWidget = window.AIWidget || {};
    window.AIWidget.config = config;
  }

  fetch(apiBase + "/api/widget/config?key=" + encodeURIComponent(publicKey), {
    credentials: "omit",
  })
    .then(function (response) {
      if (!response.ok) throw new Error("widget config request failed");
      return response.json();
    })
    .then(mount)
    .catch(function (error) {
      console.error("[ai-widget] Could not load widget configuration.", error);
    });
})();
`;
