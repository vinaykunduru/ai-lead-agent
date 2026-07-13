/**
 * Source for the public embed SDK, served as-is (no build step) by
 * GET /api/widget/sdk.js. Kept as a template string rather than a bundled
 * asset so it stays a single, auditable, framework-independent file — see
 * module spec §15: "framework-independent, usable on any website."
 *
 * As of the Conversation Engine milestone: loads the widget, fetches
 * public config, renders a shell, applies the theme, and now sends real
 * messages to POST /api/widget/messages and streams the reply back
 * (module spec §12: "Only replace the mocked transport with the real
 * conversation client" — theme/appearance/configuration/installation are
 * all untouched from the Widget Platform milestone). It never calls an AI
 * provider directly, never stores anything beyond a local visitor id, and
 * never opens a WebSocket — SSE-framed text over a POST fetch only.
 *
 * A native `EventSource` can't be used here because it only supports GET
 * requests; this reads `response.body` as a stream and parses the same
 * `data: {...}\n\n` framing manually (see readSseStream below) — the wire
 * format is still genuine SSE, only the delivery API differs from the
 * browser's built-in assumptions.
 *
 * Origin validation happens server-side on every request (both
 * /api/widget/config and /api/widget/messages check the browser's own
 * `Origin` header against the widget's allowed domains) — the browser
 * attaches that header automatically; the SDK itself does not and cannot
 * forge it.
 *
 * As of the Lead Management + Human Inbox milestone: also polls
 * GET /api/widget/conversations/:id/messages every few seconds while the
 * panel is open, so a reply a human agent sends from the Inbox (module
 * spec §6 "Human Takeover") actually reaches the visitor. This is a
 * separate, plain GET+JSON endpoint — not a WebSocket, not a change to the
 * SSE transport or the streaming execution pipeline.
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

  var state = { conversationId: null, sending: false, lastMessageAt: null, seenMessageIds: {} };
  var fallbackVisitorId = null;
  var pollTimer = null;
  var POLL_INTERVAL_MS = 4000;

  function fallbackUuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function generateId() {
    return window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : fallbackUuid();
  }

  // A stable, non-PII correlation token, persisted so a returning visitor
  // is recognized as the same conversation_sessions row server-side — see
  // db/schema/conversation-sessions.ts. Never a real account identifier.
  function getVisitorId() {
    var storageKey = "ai_widget_visitor_id";
    try {
      var stored = window.localStorage.getItem(storageKey);
      if (stored) return stored;
      var generated = generateId();
      window.localStorage.setItem(storageKey, generated);
      return generated;
    } catch (e) {
      // Storage unavailable (privacy mode, etc.) — fall back to an
      // in-memory id that only lasts this page load.
      if (!fallbackVisitorId) fallbackVisitorId = generateId();
      return fallbackVisitorId;
    }
  }

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

  function appendBubble(container, role, config) {
    var bubble = document.createElement("div");
    bubble.className = "ai-widget-bubble ai-widget-bubble-" + role;

    var textEl = document.createElement("span");
    textEl.className = "ai-widget-bubble-text";
    bubble.appendChild(textEl);

    if (config.behaviour.showTimestamp) {
      var time = document.createElement("span");
      time.className = "ai-widget-bubble-time";
      time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      bubble.appendChild(time);
    }

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
    return { root: bubble, textEl: textEl, raw: "" };
  }

  // Only http/https — blocks a javascript: URI or similar from ever
  // reaching a real href, regardless of whether it came from the model,
  // a malicious knowledge-base document, or a prompt-injection attempt.
  function isSafeUrl(url) {
    try {
      var parsed = new URL(url, window.location.href);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (e) {
      return false;
    }
  }

  function makeLink(text, url) {
    var a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = text;
    return a;
  }

  // Parses a single line of inline markdown — [text](url), **bold**, and
  // bare https:// URLs — into real DOM nodes. Never uses innerHTML on any
  // text derived from the model or the knowledge base; every node is built
  // via createElement/createTextNode/textContent, so there is no path for
  // markup in a response to become live HTML.
  function appendInline(el, text) {
    var pattern = /\\[([^\\]]+)\\]\\(([^)]+)\\)|\\*\\*([^*]+)\\*\\*|(https?:\\/\\/[^\\s)]+)/g;
    var lastIndex = 0;
    var match;
    while ((match = pattern.exec(text))) {
      if (match.index > lastIndex) {
        el.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      if (match[1] !== undefined) {
        el.appendChild(isSafeUrl(match[2]) ? makeLink(match[1], match[2]) : document.createTextNode(match[0]));
      } else if (match[3] !== undefined) {
        var strong = document.createElement("strong");
        strong.textContent = match[3];
        el.appendChild(strong);
      } else if (match[4] !== undefined) {
        el.appendChild(isSafeUrl(match[4]) ? makeLink(match[4], match[4]) : document.createTextNode(match[4]));
      }
      lastIndex = pattern.lastIndex;
    }
    if (lastIndex < text.length) {
      el.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
  }

  // Re-renders a bubble's full text as markdown (paragraphs, bullet/numbered
  // lists, bold, links) on every call — simplest correct approach for a
  // token stream, since list/paragraph structure can only be recognized
  // once a full line has arrived, not from a single token fragment. Message
  // bodies are short enough that rebuilding the subtree each token is cheap.
  function renderAssistantText(textEl, fullText) {
    while (textEl.firstChild) textEl.removeChild(textEl.firstChild);
    var lines = fullText.split("\\n");
    var i = 0;
    while (i < lines.length) {
      if (/^\\s*[-*]\\s+/.test(lines[i])) {
        var ul = document.createElement("ul");
        ul.className = "ai-widget-list";
        while (i < lines.length && /^\\s*[-*]\\s+/.test(lines[i])) {
          var li = document.createElement("li");
          appendInline(li, lines[i].replace(/^\\s*[-*]\\s+/, ""));
          ul.appendChild(li);
          i++;
        }
        textEl.appendChild(ul);
        continue;
      }
      if (/^\\s*\\d+\\.\\s+/.test(lines[i])) {
        var ol = document.createElement("ol");
        ol.className = "ai-widget-list";
        while (i < lines.length && /^\\s*\\d+\\.\\s+/.test(lines[i])) {
          var liNum = document.createElement("li");
          appendInline(liNum, lines[i].replace(/^\\s*\\d+\\.\\s+/, ""));
          ol.appendChild(liNum);
          i++;
        }
        textEl.appendChild(ol);
        continue;
      }
      if (lines[i].trim() === "") {
        i++;
        continue;
      }
      var p = document.createElement("p");
      p.className = "ai-widget-paragraph";
      appendInline(p, lines[i]);
      textEl.appendChild(p);
      i++;
    }
  }

  // Reads a fetch Response body as SSE framing and calls onEvent for each
  // parsed \`data:\` payload — the client-side mirror of
  // providers/ai/sse-parser.ts and modules/conversation/transport/sse.ts's
  // wire format.
  function readSseStream(body, onEvent) {
    var reader = body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";

    function pump() {
      return reader.read().then(function (result) {
        if (result.done) return;
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split("\\n");
        buffer = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (line.indexOf("data:") === 0) {
            var payload = line.slice(5).trim();
            if (payload) {
              try {
                onEvent(JSON.parse(payload));
              } catch (e) {
                // Malformed event — skip it rather than breaking the stream.
              }
            }
          }
        }
        return pump();
      });
    }

    return pump();
  }

  function sendMessage(text, elements, config) {
    var trimmed = (text || "").trim();
    if (!trimmed || state.sending) return;
    state.sending = true;
    elements.input.value = "";
    elements.sendButton.disabled = true;

    appendBubble(elements.messages, "user", config).textEl.textContent = trimmed;
    var assistant = appendBubble(elements.messages, "assistant", config);
    if (config.behaviour.showTypingIndicator) {
      assistant.root.classList.add("ai-widget-typing");
    }

    fetch(apiBase + "/api/widget/messages", {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: publicKey,
        visitorId: getVisitorId(),
        conversationId: state.conversationId || undefined,
        message: trimmed,
      }),
    })
      .then(function (response) {
        if (!response.ok || !response.body) throw new Error("message request failed");
        return readSseStream(response.body, function (event) {
          if (event.type === "ready") {
            state.conversationId = event.conversationId;
          } else if (event.type === "token") {
            assistant.root.classList.remove("ai-widget-typing");
            assistant.raw += event.text;
            renderAssistantText(assistant.textEl, assistant.raw);
            elements.messages.scrollTop = elements.messages.scrollHeight;
          } else if (event.type === "handoff") {
            assistant.root.classList.remove("ai-widget-typing");
            assistant.raw = event.message;
            renderAssistantText(assistant.textEl, assistant.raw);
          } else if (event.type === "error") {
            assistant.root.classList.remove("ai-widget-typing");
            assistant.root.classList.add("ai-widget-error");
            assistant.textEl.textContent = event.message;
          } else if (event.type === "done") {
            if (event.messageId) state.seenMessageIds[event.messageId] = true;
            state.lastMessageAt = new Date().toISOString();
          }
          // "citations": no UI action yet — the widget doesn't render
          // citations in this phase (module spec §7).
        });
      })
      .catch(function () {
        assistant.root.classList.remove("ai-widget-typing");
        assistant.root.classList.add("ai-widget-error");
        assistant.textEl.textContent =
          config.behaviour.offlineMessage || "Something went wrong. Please try again.";
      })
      .then(function () {
        // Started only once the current turn's own stream has fully
        // resolved (done/handoff/error), never while it's still in
        // flight — polling exists to pick up a human agent's reply sent
        // later via the Inbox, not to race the widget's own request.
        // Starting it any earlier can catch the assistant's message
        // between the moment execution-pipeline.ts marks it complete in
        // the database and the moment the "done" SSE event (which records
        // the id in state.seenMessageIds) actually reaches the browser,
        // rendering the same reply a second time.
        startPolling(elements, config);
        state.sending = false;
        elements.sendButton.disabled = false;
      });
  }

  // Picks up replies the widget didn't already render itself — chiefly a
  // human agent's reply sent from the Inbox, which has no SSE stream of
  // its own to deliver over (module spec §6). Only ever adds messages this
  // page hasn't already shown (state.seenMessageIds), so it never
  // duplicates the current turn's own streamed response.
  function startPolling(elements, config) {
    if (pollTimer || !state.conversationId) return;
    pollTimer = setInterval(function () {
      // A later message's own SSE stream is currently in flight (this
      // function only runs once, after the first message resolves, and
      // keeps ticking for the rest of the session — it does not know
      // whether a subsequent sendMessage() call is in progress). Skipping
      // the tick here avoids a race where this poll sees the assistant's
      // reply in the database (already status='complete') before the SSE
      // "done" event reaches the browser and marks it seen, rendering the
      // same reply a second time. The very next tick after sending
      // finishes will correctly pick up only genuinely new messages.
      if (state.sending) return;

      var url =
        apiBase +
        "/api/widget/conversations/" +
        state.conversationId +
        "/messages?key=" +
        encodeURIComponent(publicKey) +
        (state.lastMessageAt ? "&after=" + encodeURIComponent(state.lastMessageAt) : "");

      fetch(url, { credentials: "omit" })
        .then(function (response) {
          return response.ok ? response.json() : { messages: [] };
        })
        .then(function (data) {
          (data.messages || []).forEach(function (message) {
            state.lastMessageAt = message.createdAt;
            if (state.seenMessageIds[message.id]) return;
            state.seenMessageIds[message.id] = true;
            if (message.role === "assistant") {
              renderAssistantText(appendBubble(elements.messages, "assistant", config).textEl, message.content);
            }
          });
        })
        .catch(function () {
          // A failed poll just tries again next interval — never surfaces
          // as a visible error for a background refresh.
        });
    }, POLL_INTERVAL_MS);
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
      ".ai-widget-messages { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }",
      ".ai-widget-bubble {",
      "  max-width: 85%; padding: 8px 12px; border-radius: 12px; font-size: 13px;",
      "  display: flex; flex-direction: column; gap: 2px; white-space: pre-wrap; word-break: break-word;",
      "}",
      ".ai-widget-bubble-user { align-self: flex-end; background: var(--ai-widget-primary); color: #fff; }",
      ".ai-widget-bubble-assistant { align-self: flex-start; background: #f1f1f3; color: #111; }",
      ".ai-widget-bubble-error { background: #fdecea; color: #b3261e; }",
      ".ai-widget-bubble-time { font-size: 10px; opacity: 0.7; align-self: flex-end; }",
      ".ai-widget-typing .ai-widget-bubble-text::after { content: '...'; }",
      ".ai-widget-bubble-text { display: block; }",
      ".ai-widget-paragraph { margin: 0 0 8px; }",
      ".ai-widget-paragraph:last-child { margin-bottom: 0; }",
      ".ai-widget-list { margin: 4px 0 8px; padding-left: 18px; }",
      ".ai-widget-list:last-child { margin-bottom: 0; }",
      ".ai-widget-list li { margin-bottom: 4px; }",
      ".ai-widget-bubble-text a { color: inherit; text-decoration: underline; word-break: break-all; }",
      ".ai-widget-bubble-text strong { font-weight: 600; }",
      ".ai-widget-input-row { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid #eee; }",
      ".ai-widget-input {",
      "  flex: 1; border: 1px solid #ddd; border-radius: 999px; padding: 8px 12px; font-size: 13px; outline: none;",
      "}",
      ".ai-widget-send {",
      "  border: none; border-radius: 999px; padding: 8px 16px; font-size: 13px; cursor: pointer;",
      "  background: var(--ai-widget-primary); color: #fff;",
      "}",
      ".ai-widget-send:disabled { opacity: 0.6; cursor: default; }",
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

    var messages = document.createElement("div");
    messages.className = "ai-widget-messages";
    var elements = { messages: messages };

    if (config.behaviour.suggestedQuestions && config.behaviour.suggestedQuestions.length) {
      var suggested = document.createElement("div");
      suggested.className = "ai-widget-suggested";
      config.behaviour.suggestedQuestions.forEach(function (question) {
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = question;
        button.addEventListener("click", function () {
          sendMessage(question, elements, config);
        });
        suggested.appendChild(button);
      });
      body.appendChild(suggested);
    }
    body.appendChild(messages);
    panel.appendChild(body);

    var inputRow = document.createElement("div");
    inputRow.className = "ai-widget-input-row";
    var input = document.createElement("input");
    input.type = "text";
    input.className = "ai-widget-input";
    input.placeholder = "Type a message...";
    var sendButton = document.createElement("button");
    sendButton.type = "button";
    sendButton.className = "ai-widget-send";
    sendButton.textContent = "Send";
    inputRow.appendChild(input);
    inputRow.appendChild(sendButton);
    panel.appendChild(inputRow);

    elements.input = input;
    elements.sendButton = sendButton;

    sendButton.addEventListener("click", function () {
      sendMessage(input.value, elements, config);
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMessage(input.value, elements, config);
      }
    });

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

    // Public, read-only handle — never expands to expose anything beyond
    // the same public config the SDK itself already fetched.
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
