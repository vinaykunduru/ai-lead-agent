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
 * provider directly, never stores anything beyond a local visitor id and a
 * small conversation-session pointer (see below), and never opens a
 * WebSocket — SSE-framed text over a POST fetch only.
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
 *
 * As of the conversation-persistence fix: a small session object
 * (conversationId, draft text, panel-open state, a sliding expiresAt —
 * never message content) is written to localStorage under
 * `ai_widget_session_<publicKey>` on every state change and read back on
 * every page load, so navigating between pages on the same site — or
 * refreshing — resumes the same conversation instead of starting a new one
 * every time (see getSessionStorageKey/loadSession/saveSession/
 * restoreHistory/handleStorageSync below). The server side of this was
 * already correct: session-service.ts's resolveSession always reuses the
 * existing conversation_sessions row for a returning visitorId, and
 * resolveConversation silently starts a fresh thread for a missing, stale,
 * or foreign conversationId rather than erroring — this fix is entirely
 * about the *client* actually remembering and resending the conversationId
 * it already has a right to reuse.
 *
 * As of the persistence UX-polish pass: the same session object also
 * carries `scrollTop` (restored once history re-renders, so a visitor who
 * had scrolled up to read stays there instead of snapping to the bottom)
 * and `pendingSince` (set while a reply is in flight, cleared once it
 * resolves — see maybeResumePendingResponse). A small "welcome back"
 * banner and a Web Locks–coordinated first message (falling back to the
 * existing storage-event adoption when the API is unavailable) round this
 * out — see showWelcomeBackBanner/sendMessageCoordinated below. None of
 * this changes the server-side session flow or the Visitor Profile
 * pipeline; it is purely how the already-approved persisted session is
 * presented and coordinated client-side.
 *
 * As of the "feels alive" polish pass: purely perceptual changes on top of
 * the exact same transport/pipeline — animated typing dots and a blinking
 * cursor while a reply streams in, a subtle entrance animation on every new
 * bubble, richer Send button states (hover/press/sending/error), and
 * scroll-during-streaming now respects a manual scroll away from the
 * bottom the same way the polling loop already did. Every animation is
 * transform/opacity-only (no layout-affecting properties) and disabled
 * under `prefers-reduced-motion`. No new network calls, no change to when
 * or how often the widget talks to the server.
 *
 * As of the "premium micro-interactions" pass: the thinking indicator now
 * rotates through a small set of honest, generic status phrases (never a
 * claim about a specific internal step that may not actually be
 * happening) instead of only showing dots; the same bubble morphs into the
 * streamed response in place via a brief one-time opacity transition
 * (never a second bubble swapped in); consecutive same-role messages sit
 * closer together; an assistant message shows a small avatar (the org's
 * configured appearance.avatarUrl, falling back to an initial derived from
 * config.name — never a hardcoded brand icon, since this SDK is shared by
 * every tenant's widget); the header gains a minimal status line; and
 * history restore shows its own brief loading phrase. A context/topic chip
 * was deliberately NOT built here — it would require exposing the Visitor
 * Profile's AI-derived intent through a new public, unauthenticated
 * endpoint, which is a real data-exposure decision outside this pass's
 * scope, not a styling one. Still no new network calls, no change to the
 * transport, and every new animation remains transform/opacity-only with a
 * `prefers-reduced-motion` override.
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

  var state = {
    conversationId: null,
    sending: false,
    lastMessageAt: null,
    // Assistant-only, unlike lastMessageAt (every role) — the visitor's own
    // just-sent message is always present and always newer than the moment
    // it was sent, so maybeResumePendingResponse needs a signal that can't
    // be satisfied by the visitor's own echoed-back message.
    lastAssistantMessageAt: null,
    seenMessageIds: {},
  };
  var fallbackVisitorId = null;
  var pollTimer = null;
  var POLL_INTERVAL_MS = 4000;
  // How long a reply is allowed to stay "pending" after a page restore
  // before the widget gives up waiting and shows a failure state instead
  // of an indicator that never resolves (module spec: "or the request
  // times out").
  var PENDING_TIMEOUT_MS = 45000;
  // Within this many px of the bottom counts as "already reading the
  // latest message" for auto-scroll purposes — matches the everyday
  // chat-app definition of "near bottom" (ChatGPT, Slack, etc.).
  var NEAR_BOTTOM_PX = 80;

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

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        fn.apply(null, args);
      }, wait);
    };
  }

  function isNearBottom(container) {
    return container.scrollHeight - container.scrollTop - container.clientHeight < NEAR_BOTTOM_PX;
  }

  function scrollToBottom(container) {
    container.scrollTop = container.scrollHeight;
  }

  // Real DOM nodes rather than a CSS ::after trick, so they can be cleanly
  // inserted into an otherwise-empty assistant bubble and removed the same
  // way renderAssistantText already clears everything else — no separate
  // teardown path needed.
  function createTypingDots() {
    var wrap = document.createElement("span");
    wrap.className = "ai-widget-typing-dots";
    wrap.setAttribute("aria-hidden", "true");
    for (var i = 0; i < 3; i++) {
      wrap.appendChild(document.createElement("span"));
    }
    return wrap;
  }

  // Appended after the live text on every token so it always sits at the
  // end of whatever has streamed in so far; removed once generation
  // finishes (module spec: "Remove the cursor when generation completes").
  function appendCursor(textEl) {
    var cursor = document.createElement("span");
    cursor.className = "ai-widget-cursor";
    cursor.setAttribute("aria-hidden", "true");
    textEl.appendChild(cursor);
  }

  function removeCursor(textEl) {
    var cursor = textEl.querySelector(".ai-widget-cursor");
    if (cursor && cursor.parentNode) cursor.parentNode.removeChild(cursor);
  }

  // Deliberately generic across every possible business/vertical this SDK
  // could be embedded for, and deliberately non-specific about *what* is
  // happening server-side (never "Searching our database" or similar — a
  // claim about a concrete step that may not actually be true for a given
  // request). These only ever communicate "a real reply is being put
  // together," which is always true whenever this indicator is shown.
  var THINKING_PHRASES = [
    "Thinking",
    "Looking into that for you",
    "Preparing your answer",
    "Reviewing your message",
    "Putting this together",
    "Working on it",
  ];

  function pickThinkingPhrase(exclude) {
    var pool = exclude
      ? THINKING_PHRASES.filter(function (phrase) {
          return phrase !== exclude;
        })
      : THINKING_PHRASES;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Same dots as createTypingDots plus a short rotating status phrase,
  // bundled together since every "something is happening" moment in this
  // SDK (thinking, resuming a pending reply) wants both.
  function createThinkingStatus() {
    var wrap = document.createElement("span");
    wrap.className = "ai-widget-thinking-status";
    wrap.setAttribute("aria-hidden", "true");
    var text = document.createElement("span");
    text.className = "ai-widget-thinking-text";
    text.textContent = pickThinkingPhrase();
    wrap.appendChild(text);
    wrap.appendChild(createTypingDots());
    return { root: wrap, textEl: text };
  }

  // Swaps the visible phrase every couple of seconds so a longer wait
  // doesn't feel stuck on one line — purely decorative text, not
  // re-announced to screen readers on every rotation (the one "<name> is
  // thinking" aria-live announcement already covers the accessible story;
  // re-announcing every 2s would just be noisy).
  function startThinkingRotation(textNode) {
    var last = textNode.textContent;
    return setInterval(function () {
      last = pickThinkingPhrase(last);
      textNode.textContent = last;
    }, 2200);
  }

  function stopThinkingRotation(rotatorId) {
    if (rotatorId) window.clearInterval(rotatorId);
  }

  // Single shared aria-live region for the "thinking" status (module spec
  // §10: "Announce '<name> is thinking' using aria-live") — never a
  // hardcoded brand name, since this SDK is shared by every tenant's
  // widget; config.name is whatever that org actually configured.
  function announce(elements, text) {
    if (elements.liveRegion) elements.liveRegion.textContent = text;
  }

  // The per-widget-key persisted session — conversationId, draft text, and
  // panel-open state — is what lets the widget survive a full page
  // navigation or refresh instead of starting a blank conversation every
  // time (module spec: "The AI conversation must persist across page
  // navigation"). Deliberately does NOT cache message content: history is
  // always re-fetched from the server on restore (readSseStream/
  // restoreHistory below), so this stays a small, cheap-to-write pointer
  // rather than a second, driftable copy of the transcript.
  function getSessionStorageKey() {
    return "ai_widget_session_" + publicKey;
  }

  function loadSession() {
    try {
      var raw = window.localStorage.getItem(getSessionStorageKey());
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      // Sliding expiration: a valid session is one still inside its
      // configurable window (module spec: "configurable duration, e.g. 24
      // hours") as of the last time it was written — every write refreshes
      // expiresAt, so active use keeps extending it.
      if (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= Date.now()) {
        window.localStorage.removeItem(getSessionStorageKey());
        return null;
      }
      return parsed;
    } catch (e) {
      // Storage unavailable (privacy mode, etc.) — no persisted session,
      // same as a first-time visitor; every other feature still works for
      // the current page load.
      return null;
    }
  }

  function saveSession(config, patch) {
    try {
      var existing = loadSession() || {};
      var timeoutMinutes =
        (config && config.behaviour && config.behaviour.sessionTimeoutMinutes) || 1440;
      var merged = {
        conversationId: patch.conversationId !== undefined ? patch.conversationId : existing.conversationId || null,
        draft: patch.draft !== undefined ? patch.draft : existing.draft || "",
        panelOpen: patch.panelOpen !== undefined ? patch.panelOpen : existing.panelOpen || false,
        // Reading position within the transcript — null (not 0) means
        // "never recorded," distinct from a visitor who genuinely scrolled
        // all the way to the top, which is a legitimate 0.
        scrollTop:
          patch.scrollTop !== undefined
            ? patch.scrollTop
            : existing.scrollTop !== undefined
              ? existing.scrollTop
              : null,
        // Set while a reply is in flight, cleared the moment it resolves —
        // lets a later page load know to resume waiting rather than sit
        // idle (see maybeResumePendingResponse).
        pendingSince: patch.pendingSince !== undefined ? patch.pendingSince : existing.pendingSince || null,
        expiresAt: new Date(Date.now() + timeoutMinutes * 60000).toISOString(),
      };
      window.localStorage.setItem(getSessionStorageKey(), JSON.stringify(merged));
    } catch (e) {
      // Nothing to fall back to — the conversation still works for this
      // page load, it just won't survive navigation in this browser.
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

  // "outer" (the element actually appended to container) differs from
  // "root" (always the bubble itself) only for assistant messages, which
  // get wrapped in a small avatar+bubble row — see below. Every existing
  // caller that toggles state classes (ai-widget-typing/-error) keeps using
  // .root, since that's still always the bubble; only the two callers that
  // remove a bubble entirely need .outer, so the avatar doesn't get left
  // behind as an orphaned element.
  function appendBubble(container, role, config, timestamp) {
    // Two consecutive messages from the same role are visually grouped
    // (tighter spacing, avatar shown only once) — matches the last element
    // actually appended, whether that was a bare bubble (user) or a row
    // (assistant), via the shared data-role marker set below.
    var lastOuter = container.lastElementChild;
    var grouped = !!(lastOuter && lastOuter.getAttribute("data-role") === role);

    var bubble = document.createElement("div");
    bubble.className = "ai-widget-bubble ai-widget-bubble-" + role + (grouped ? " ai-widget-bubble-grouped" : "");

    var textEl = document.createElement("span");
    textEl.className = "ai-widget-bubble-text";
    bubble.appendChild(textEl);

    if (config.behaviour.showTimestamp) {
      var time = document.createElement("span");
      time.className = "ai-widget-bubble-time";
      time.textContent = (timestamp || new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      bubble.appendChild(time);
    }

    var outer = bubble;
    if (role === "assistant") {
      var row = document.createElement("div");
      row.className = "ai-widget-message-row" + (grouped ? " ai-widget-row-grouped" : "");
      var avatar = document.createElement("span");
      avatar.className = "ai-widget-avatar";
      avatar.setAttribute("aria-hidden", "true");
      if (grouped) {
        // Reserve the same width so the bubble stays aligned with the rest
        // of the group, without repeating the avatar for every message.
        avatar.style.visibility = "hidden";
      } else if (config.appearance && config.appearance.avatarUrl) {
        var avatarImg = document.createElement("img");
        avatarImg.src = config.appearance.avatarUrl;
        avatarImg.alt = "";
        avatar.appendChild(avatarImg);
      } else {
        avatar.textContent = (config.name || "A").charAt(0).toUpperCase();
      }
      row.appendChild(avatar);
      row.appendChild(bubble);
      outer = row;
    }
    outer.setAttribute("data-role", role);

    container.appendChild(outer);
    container.scrollTop = container.scrollHeight;
    return { root: bubble, outer: outer, textEl: textEl, raw: "" };
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

  function setSending(elements, sending) {
    elements.sendButton.disabled = sending;
    elements.input.disabled = sending;
    elements.sendButton.classList.toggle("sending", sending);
  }

  function flashSendError(elements) {
    var button = elements.sendButton;
    button.classList.remove("error");
    // Force a reflow so re-adding the class restarts the shake animation
    // even if a previous one hasn't finished — void the expression so
    // nothing depends on the (otherwise unused) read triggering it.
    void button.offsetWidth;
    button.classList.add("error");
    setTimeout(function () {
      button.classList.remove("error");
    }, 400);
  }

  function sendMessage(text, elements, config) {
    var trimmed = (text || "").trim();
    if (!trimmed || state.sending) return;
    state.sending = true;
    elements.input.value = "";
    setSending(elements, true);
    saveSession(config, { draft: "", pendingSince: new Date().toISOString() });

    if (elements.suggestedContainer && elements.suggestedContainer.parentNode) {
      elements.suggestedContainer.parentNode.removeChild(elements.suggestedContainer);
      elements.suggestedContainer = null;
    }

    appendBubble(elements.messages, "user", config).textEl.textContent = trimmed;
    var assistant = appendBubble(elements.messages, "assistant", config);
    scrollToBottom(elements.scrollContainer);
    var statusRotator = null;
    // Set once the first token arrives, so the dots→text swap gets the
    // brief morph transition exactly once and every later token just
    // updates text normally (no per-token flicker).
    var morphed = false;
    if (config.behaviour.showTypingIndicator) {
      assistant.root.classList.add("ai-widget-typing");
      var thinking = createThinkingStatus();
      assistant.textEl.appendChild(thinking.root);
      statusRotator = startThinkingRotation(thinking.textEl);
      announce(elements, (config.name || "The assistant") + " is thinking");
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
            saveSession(config, { conversationId: state.conversationId });
          } else if (event.type === "token") {
            if (!morphed) {
              morphed = true;
              stopThinkingRotation(statusRotator);
              statusRotator = null;
              // The dots/status text get cleared by renderAssistantText
              // below same as always — this class just gives that exact
              // moment a brief cross-fade instead of an instant swap, so it
              // reads as the bubble "turning into" the response rather than
              // being replaced (module spec: "Same bubble, same position,
              // no jump, no flicker").
              assistant.textEl.classList.add("ai-widget-morph");
            }
            assistant.root.classList.remove("ai-widget-typing");
            assistant.raw += event.text;
            renderAssistantText(assistant.textEl, assistant.raw);
            appendCursor(assistant.textEl);
            // Respects a visitor who scrolled up mid-stream to read earlier
            // messages, same rule the polling loop already follows — never
            // yank them back down just because their own reply is still
            // arriving.
            if (isNearBottom(elements.scrollContainer)) scrollToBottom(elements.scrollContainer);
          } else if (event.type === "handoff") {
            stopThinkingRotation(statusRotator);
            statusRotator = null;
            assistant.root.classList.remove("ai-widget-typing");
            assistant.raw = event.message;
            renderAssistantText(assistant.textEl, assistant.raw);
          } else if (event.type === "error") {
            stopThinkingRotation(statusRotator);
            statusRotator = null;
            assistant.root.classList.remove("ai-widget-typing");
            assistant.root.classList.add("ai-widget-error");
            assistant.textEl.textContent = event.message;
          } else if (event.type === "done") {
            removeCursor(assistant.textEl);
            announce(elements, "");
            if (event.messageId) state.seenMessageIds[event.messageId] = true;
            state.lastMessageAt = new Date().toISOString();
          }
          // "citations": no UI action yet — the widget doesn't render
          // citations in this phase (module spec §7).
        });
      })
      .catch(function () {
        // A true send failure (network error, non-2xx response) — the
        // message never reliably reached the server, unlike a mid-stream
        // "error" SSE event above (where the visitor's message was already
        // recorded and only the reply generation failed). Restore it so
        // the visitor doesn't have to retype anything before retrying.
        stopThinkingRotation(statusRotator);
        statusRotator = null;
        assistant.root.classList.remove("ai-widget-typing");
        assistant.root.classList.add("ai-widget-error");
        assistant.textEl.textContent =
          config.behaviour.offlineMessage || "Sorry, something went wrong. Please try again.";
        announce(elements, "");
        elements.input.value = trimmed;
        saveSession(config, { draft: trimmed, pendingSince: null });
        flashSendError(elements);
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
        saveSession(config, { conversationId: state.conversationId, pendingSince: null });
        state.sending = false;
        setSending(elements, false);
        elements.input.focus();
      });
  }

  // Coordinates the *first* message of a fresh conversation across
  // multiple tabs (module spec: "Never create duplicate conversations for
  // the same visitor during simultaneous first messages"). Every message
  // after the first already carries state.conversationId, so there is
  // nothing to coordinate — this only ever wraps the one call that would
  // otherwise race. sendMessage itself is untouched; this only decides
  // *when* to call it.
  function sendMessageCoordinated(text, elements, config) {
    var trimmed = (text || "").trim();
    if (!trimmed || state.sending) return;

    if (state.conversationId || !(window.navigator && window.navigator.locks && window.navigator.locks.request)) {
      sendMessage(text, elements, config);
      return;
    }

    // The losing side of the race below can wait up to ~2s
    // (waitForConversationId) before sendMessage itself ever runs — show
    // the sending state immediately rather than leaving the button
    // clickable and the input untouched for that whole window.
    setSending(elements, true);

    window.navigator.locks
      .request(
        "ai-widget-first-message-" + publicKey,
        { ifAvailable: true },
        function (lock) {
          if (!lock) {
            // Another tab already claimed the first message for this
            // visitor — adopt its conversation id (handleStorageSync writes
            // it within a few hundred ms of the server's "ready" event)
            // instead of racing to create a second conversation, then
            // continue this tab's own message onto that same thread.
            return waitForConversationId().then(function () {
              sendMessage(text, elements, config);
            });
          }
          // Won the race: send now. The lock is held until the promise
          // below resolves — i.e. until this tab's own conversation id
          // comes back (or a short timeout elapses) — so a second tab's
          // {ifAvailable} check in that brief window correctly sees "taken"
          // rather than racing in and creating its own conversation.
          sendMessage(text, elements, config);
          return waitForConversationId();
        },
      )
      .catch(function () {
        // The API existed but the request itself failed (e.g. a
        // Permissions-Policy blocking web-locks in an embedded iframe) —
        // sendMessage's own state.sending guard makes this a safe no-op if
        // the callback above already started it; if the rejection happened
        // before the callback ever ran, this is the only thing standing
        // between the visitor and a silently dropped first message.
        sendMessage(text, elements, config);
      });
  }

  // Lightweight in-memory/localStorage poll (no network requests) used
  // only by the losing side of the first-message race above — bounded to
  // 2s so a visitor's own message is never stuck waiting indefinitely if
  // the winning tab's request fails outright.
  function waitForConversationId() {
    return new Promise(function (resolve) {
      var attempts = 0;
      var timer = setInterval(function () {
        attempts++;
        if (!state.conversationId) {
          var session = loadSession();
          if (session && session.conversationId) state.conversationId = session.conversationId;
        }
        if (state.conversationId || attempts >= 20) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
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
          var incoming = data.messages || [];
          if (incoming.length === 0) return;
          // Measured before appending: a visitor already reading older
          // messages should never get yanked to the bottom by a reply
          // that arrived while they were scrolled up (module spec: "If
          // new messages arrive while restoring/reading, automatically
          // scroll to the latest message only if the user was already
          // near the bottom. Otherwise preserve the user's reading
          // position").
          var wasNearBottom = isNearBottom(elements.scrollContainer);
          incoming.forEach(function (message) {
            state.lastMessageAt = message.createdAt;
            if (state.seenMessageIds[message.id]) return;
            state.seenMessageIds[message.id] = true;
            if (message.role === "assistant") {
              state.lastAssistantMessageAt = message.createdAt;
              renderAssistantText(appendBubble(elements.messages, "assistant", config).textEl, message.content);
            }
          });
          if (wasNearBottom) scrollToBottom(elements.scrollContainer);
        })
        .catch(function () {
          // A failed poll just tries again next interval — never surfaces
          // as a visible error for a background refresh.
        });
    }, POLL_INTERVAL_MS);
  }

  // Re-renders a previously-started conversation's full transcript on a
  // fresh page load (module spec: "Automatically restore previous
  // messages... The user should never notice that the page changed").
  // Always re-fetches from the server rather than trusting anything cached
  // client-side, since the server (and the visitor-profile pipeline that
  // reads from it) is the single source of truth. Once restored, polling
  // starts immediately — not gated behind the visitor sending a first
  // message on this page — so a reply sent from another tab or the human
  // Inbox while this page was loading still shows up.
  //
  // onRendered(succeeded), if given, fires once messages have been
  // appended (or the fetch failed) — the one hook point the init-restore
  // flow needs for scroll restoration and the welcome-back banner, kept
  // out of this function itself so handleStorageSync's cross-tab restore
  // (a different situation — "another tab told me about a conversation,"
  // not "I am resuming my own") can keep calling this without either of
  // those extras.
  function restoreHistory(elements, config, conversationId, onRendered) {
    var url =
      apiBase + "/api/widget/conversations/" + conversationId + "/messages?key=" + encodeURIComponent(publicKey);

    // A brief, honest loading phrase for the one operation that previously
    // had none — the panel could sit visually empty for a moment while
    // history loads. Removed the instant a result (success or failure)
    // comes back; on a fast connection this simply never gets time to be
    // noticed, which is fine — nothing here artificially extends the wait.
    var restoring = document.createElement("div");
    restoring.className = "ai-widget-status-line";
    restoring.setAttribute("aria-hidden", "true");
    var restoringText = document.createElement("span");
    restoringText.textContent = "Restoring your conversation";
    restoring.appendChild(restoringText);
    restoring.appendChild(createTypingDots());
    elements.messages.appendChild(restoring);

    function clearRestoringIndicator() {
      if (restoring.parentNode) restoring.parentNode.removeChild(restoring);
    }

    return fetch(url, { credentials: "omit" })
      .then(function (response) {
        return response.ok ? response.json() : { messages: [] };
      })
      .then(function (data) {
        clearRestoringIndicator();
        (data.messages || []).forEach(function (message) {
          state.lastMessageAt = message.createdAt;
          if (state.seenMessageIds[message.id]) return;
          state.seenMessageIds[message.id] = true;
          var bubble = appendBubble(elements.messages, message.role, config, new Date(message.createdAt));
          if (message.role === "assistant") {
            state.lastAssistantMessageAt = message.createdAt;
            renderAssistantText(bubble.textEl, message.content);
          } else {
            bubble.textEl.textContent = message.content;
          }
        });
        startPolling(elements, config);
        if (onRendered) onRendered(true);
        return { ok: true };
      })
      .catch(function () {
        // The conversationId itself is still valid server-side even if this
        // one fetch failed (offline, transient network error) — the next
        // message the visitor sends still continues the same thread rather
        // than silently forking a new one; this page view just starts
        // without visible history. Graceful fallback: scroll to the
        // (empty) bottom rather than leaving a half-restored scroll state.
        clearRestoringIndicator();
        scrollToBottom(elements.scrollContainer);
        startPolling(elements, config);
        if (onRendered) onRendered(false);
        return { ok: false };
      });
  }

  // Resumes waiting for a reply that was still generating when the
  // visitor navigated away or refreshed (module spec: "the widget should
  // not appear idle... Continue polling until the response arrives or the
  // request times out... Do not send the prompt again"). Never issues a
  // new POST — the message was already recorded server-side by the page
  // that originally sent it; this only shows the same typing indicator a
  // live turn uses and leans on the polling restoreHistory already
  // started to notice when the reply (or a timeout) resolves it.
  function maybeResumePendingResponse(elements, config, pendingSince) {
    var pendingTime = new Date(pendingSince).getTime();
    // Deliberately the assistant-only timestamp, not lastMessageAt — the
    // visitor's own message (which triggered this pendingSince in the
    // first place) is always present and always at-or-after pendingTime,
    // so comparing against "any message" would treat every pending reply
    // as already resolved and never show the resumed typing indicator.
    var lastKnownAssistantTime = state.lastAssistantMessageAt ? new Date(state.lastAssistantMessageAt).getTime() : 0;
    if (lastKnownAssistantTime >= pendingTime) {
      // The reply already arrived and was just rendered by restoreHistory
      // above — nothing left to wait for.
      saveSession(config, { pendingSince: null });
      return;
    }

    var elapsedMs = Date.now() - pendingTime;
    if (elapsedMs >= PENDING_TIMEOUT_MS) {
      saveSession(config, { pendingSince: null });
      return;
    }

    var typingBubble = appendBubble(elements.messages, "assistant", config);
    typingBubble.root.classList.add("ai-widget-typing");
    var thinking = createThinkingStatus();
    typingBubble.textEl.appendChild(thinking.root);
    var statusRotator = startThinkingRotation(thinking.textEl);
    scrollToBottom(elements.scrollContainer);
    announce(elements, (config.name || "The assistant") + " is thinking");

    var seenCountAtStart = Object.keys(state.seenMessageIds).length;
    var deadline = Date.now() + (PENDING_TIMEOUT_MS - elapsedMs);

    var watcher = setInterval(function () {
      if (Object.keys(state.seenMessageIds).length > seenCountAtStart) {
        clearInterval(watcher);
        stopThinkingRotation(statusRotator);
        // .outer, not .root — for an assistant bubble that's the avatar+
        // bubble row, so removing it doesn't leave an orphaned avatar
        // behind once the real (already-rendered) reply takes its place.
        if (typingBubble.outer.parentNode) typingBubble.outer.parentNode.removeChild(typingBubble.outer);
        announce(elements, "");
        saveSession(config, { pendingSince: null });
        return;
      }
      if (Date.now() >= deadline) {
        clearInterval(watcher);
        stopThinkingRotation(statusRotator);
        typingBubble.root.classList.remove("ai-widget-typing");
        typingBubble.root.classList.add("ai-widget-error");
        typingBubble.textEl.textContent =
          config.behaviour.offlineMessage || "This response could not be completed. Please try again.";
        announce(elements, "");
        saveSession(config, { pendingSince: null });
      }
    }, 1000);
  }

  function showWelcomeBackBanner(elements) {
    var banner = elements.restoreBanner;
    if (!banner) return;
    banner.classList.add("visible");
    setTimeout(function () {
      banner.classList.remove("visible");
    }, 3000);
  }

  // Cross-tab sync (module spec: "Handle multiple browser tabs gracefully
  // ... If another tab updates the conversation, synchronize the widget
  // state"). The "storage" event fires in every OTHER same-origin tab, never the one
  // that made the write, so this only ever adopts a conversation this tab
  // doesn't already have — a tab that already owns a thread keeps showing
  // it rather than switching away mid-conversation.
  function handleStorageSync(elements, config) {
    window.addEventListener("storage", function (event) {
      if (event.key !== getSessionStorageKey() || !event.newValue || state.conversationId) return;
      var incoming;
      try {
        incoming = JSON.parse(event.newValue);
      } catch (e) {
        return;
      }
      if (!incoming || !incoming.conversationId) return;
      if (incoming.expiresAt && new Date(incoming.expiresAt).getTime() <= Date.now()) return;

      state.conversationId = incoming.conversationId;
      restoreHistory(elements, config, incoming.conversationId);
    });
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
      ".ai-widget-header { background: var(--ai-widget-primary); color: #fff; padding: 14px 16px; }",
      ".ai-widget-header-title { font-weight: 600; font-size: 14px; }",
      ".ai-widget-header-status { display: flex; align-items: center; gap: 5px; margin-top: 3px; font-size: 11px; opacity: 0.85; }",
      ".ai-widget-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; flex: none; }",
      ".ai-widget-body {",
      "  position: relative; flex: 1; padding: 16px; overflow-y: auto; color: #111; font-size: 14px;",
      "  scroll-behavior: smooth;",
      "}",
      ".ai-widget-restore-banner {",
      "  position: absolute; top: 8px; left: 8px; right: 8px; z-index: 1;",
      "  display: flex; align-items: center; justify-content: center;",
      "  padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;",
      "  background: var(--ai-widget-primary); color: #fff; text-align: center;",
      "  opacity: 0; transform: translateY(-8px); pointer-events: none;",
      "  transition: opacity 0.25s ease, transform 0.25s ease;",
      "}",
      ".ai-widget-restore-banner.visible { opacity: 0.95; transform: translateY(0); }",
      ".ai-widget-suggested { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }",
      ".ai-widget-suggested button {",
      "  border: 1px solid var(--ai-widget-accent); color: var(--ai-widget-accent);",
      "  background: none; border-radius: 999px; padding: 6px 12px; font-size: 12px; cursor: pointer;",
      "  transition: opacity 0.15s ease, transform 0.1s ease;",
      "}",
      ".ai-widget-suggested button:hover { opacity: 0.75; }",
      ".ai-widget-suggested button:active { transform: scale(0.96); }",
      ".ai-widget-messages { display: flex; flex-direction: column; margin-top: 12px; }",
      // A history-restore/loading phrase — same dots primitive as the
      // thinking indicator, reused rather than duplicated (module spec
      // §14: "Reuse existing components").
      ".ai-widget-status-line { display: flex; align-items: center; gap: 6px; padding: 4px 0; font-size: 12px; opacity: 0.6; }",
      // Avatar+bubble row for assistant messages only — user messages stay
      // bare bubbles, direct children of .ai-widget-messages.
      ".ai-widget-message-row { display: flex; align-items: flex-end; margin-top: 8px; }",
      ".ai-widget-message-row:first-child { margin-top: 0; }",
      ".ai-widget-row-grouped { margin-top: 2px; }",
      ".ai-widget-avatar {",
      "  width: 20px; height: 20px; border-radius: 50%; flex: none; margin-right: 6px;",
      "  display: flex; align-items: center; justify-content: center; overflow: hidden;",
      "  background: var(--ai-widget-primary); color: #fff; font-size: 10px; font-weight: 600;",
      "}",
      ".ai-widget-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }",
      ".ai-widget-bubble {",
      "  max-width: 85%; padding: 8px 12px; border-radius: 12px; font-size: 13px;",
      "  display: flex; flex-direction: column; gap: 2px; white-space: pre-wrap; word-break: break-word;",
      "  animation: ai-widget-bubble-in 0.25s ease-out;",
      "}",
      // Scoped to a *direct* child of .ai-widget-messages — only true for
      // bare user bubbles. An assistant bubble is nested one level deeper
      // inside .ai-widget-message-row, which already carries its own
      // margin-top/grouped spacing, so this must not also apply there (it
      // would double the gap and misalign the bubble against its avatar).
      ".ai-widget-messages > .ai-widget-bubble { margin-top: 8px; }",
      ".ai-widget-messages > .ai-widget-bubble:first-child { margin-top: 0; }",
      ".ai-widget-messages > .ai-widget-bubble-grouped { margin-top: 2px; }",
      ".ai-widget-bubble-user { align-self: flex-end; background: var(--ai-widget-primary); color: #fff; }",
      // No align-self here: an assistant bubble now sits inside
      // .ai-widget-message-row (a flex row, not this column), where
      // align-self would instead affect vertical cross-axis alignment
      // against the avatar — the row's own left-aligned layout already
      // places assistant messages correctly.
      ".ai-widget-bubble-assistant { background: #f1f1f3; color: #111; }",
      ".ai-widget-bubble-error { background: #fdecea; color: #b3261e; }",
      ".ai-widget-bubble-time { font-size: 10px; opacity: 0.7; align-self: flex-end; }",
      ".ai-widget-bubble-text { display: block; }",
      // Three-dot "thinking" indicator — real DOM nodes (see
      // createTypingDots below), not a CSS ::after trick, so it can be
      // cleanly inserted/removed alongside streamed text without a content
      // property that can't itself be transitioned smoothly.
      ".ai-widget-typing-dots { display: inline-flex; align-items: center; gap: 3px; padding: 2px 0; }",
      ".ai-widget-typing-dots span {",
      "  width: 6px; height: 6px; border-radius: 50%; background: currentColor; opacity: 0.35;",
      "  animation: ai-widget-bounce 1.2s ease-in-out infinite;",
      "}",
      ".ai-widget-typing-dots span:nth-child(2) { animation-delay: 0.15s; }",
      ".ai-widget-typing-dots span:nth-child(3) { animation-delay: 0.3s; }",
      ".ai-widget-thinking-status { display: inline-flex; align-items: center; gap: 6px; }",
      ".ai-widget-thinking-text { font-size: 12px; opacity: 0.75; }",
      // One-time cross-fade for the moment the bubble's dots/status text
      // get replaced by the first streamed text (module spec: "Same
      // bubble, same position, no jump, no flicker") — applied once on the
      // first token and never removed, so it never re-triggers per token.
      ".ai-widget-morph { animation: ai-widget-morph-in 0.2s ease; }",
      // Streaming cursor — appended after the live text while tokens are
      // arriving, removed the moment generation finishes (see
      // appendCursor/removeCursor).
      ".ai-widget-cursor {",
      "  display: inline-block; width: 2px; height: 1em; margin-left: 1px; vertical-align: text-bottom;",
      "  background: currentColor; animation: ai-widget-blink 1s step-end infinite;",
      "}",
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
      "  transition: opacity 0.15s ease;",
      "}",
      ".ai-widget-input:disabled { opacity: 0.6; }",
      ".ai-widget-send {",
      "  border: none; border-radius: 999px; padding: 8px 16px; font-size: 13px; cursor: pointer;",
      "  background: var(--ai-widget-primary); color: #fff;",
      "  display: inline-flex; align-items: center; gap: 6px;",
      "  transition: opacity 0.15s ease, transform 0.1s ease;",
      "}",
      ".ai-widget-send:hover:not(:disabled) { opacity: 0.9; }",
      ".ai-widget-send:active:not(:disabled) { transform: scale(0.96); }",
      ".ai-widget-send:disabled { opacity: 0.6; cursor: default; }",
      ".ai-widget-send.sending { cursor: progress; }",
      ".ai-widget-send.error { animation: ai-widget-shake 0.4s ease; }",
      // Spinner box is always in flow (opacity toggle, not display toggle)
      // so its appearance never shifts the "Send" label or button width.
      ".ai-widget-send-spinner {",
      "  width: 11px; height: 11px; border-radius: 50%; flex: none;",
      "  border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;",
      "  opacity: 0; transition: opacity 0.15s ease;",
      "}",
      ".ai-widget-send.sending .ai-widget-send-spinner { opacity: 1; animation: ai-widget-spin 0.6s linear infinite; }",
      ".ai-widget-footer { padding: 8px 16px; font-size: 11px; color: #888; text-align: center; }",
      // Visually hidden but still announced by screen readers — used for
      // the "thinking" status update (module spec: accessibility §10).
      ".ai-widget-sr-only {",
      "  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;",
      "  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;",
      "}",
      "@keyframes ai-widget-bubble-in { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }",
      "@keyframes ai-widget-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.35; } 30% { transform: translateY(-4px); opacity: 1; } }",
      "@keyframes ai-widget-blink { 50% { opacity: 0; } }",
      "@keyframes ai-widget-spin { to { transform: rotate(360deg); } }",
      "@keyframes ai-widget-shake { 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }",
      "@keyframes ai-widget-morph-in { from { opacity: 0.3; } to { opacity: 1; } }",
      "@media (prefers-reduced-motion: reduce) {",
      "  .ai-widget-bubble { animation: none; }",
      "  .ai-widget-typing-dots span { animation: none; opacity: 0.7; }",
      "  .ai-widget-cursor { animation: none; opacity: 0.6; }",
      "  .ai-widget-send.error { animation: none; }",
      "  .ai-widget-send.sending .ai-widget-send-spinner { animation: none; }",
      "  .ai-widget-morph { animation: none; }",
      "  .ai-widget-body { scroll-behavior: auto; }",
      "}",
    ].join("\\n");

    var root = document.createElement("div");
    root.className = "ai-widget-root";
    root.style.position = "relative";

    var panel = document.createElement("div");
    panel.className = "ai-widget-panel";

    var header = document.createElement("div");
    header.className = "ai-widget-header";
    var headerTitle = document.createElement("div");
    headerTitle.className = "ai-widget-header-title";
    headerTitle.textContent = config.name;
    header.appendChild(headerTitle);
    // Minimal presence line (module spec: "Keep the header minimal") — a
    // static "Online" indicator, not a claim tied to live agent
    // availability or business hours (the public widget config doesn't
    // expose either), since this widget always responds, including via the
    // configured offline/handoff message outside business hours.
    var headerStatus = document.createElement("div");
    headerStatus.className = "ai-widget-header-status";
    var statusDot = document.createElement("span");
    statusDot.className = "ai-widget-status-dot";
    statusDot.setAttribute("aria-hidden", "true");
    headerStatus.appendChild(statusDot);
    headerStatus.appendChild(document.createTextNode("Online"));
    header.appendChild(headerStatus);
    panel.appendChild(header);

    var body = document.createElement("div");
    body.className = "ai-widget-body";

    var restoreBanner = document.createElement("div");
    restoreBanner.className = "ai-widget-restore-banner";
    restoreBanner.setAttribute("role", "status");
    restoreBanner.setAttribute("aria-live", "polite");
    restoreBanner.textContent = "Welcome back! Continue where you left off.";
    body.appendChild(restoreBanner);

    var welcome = document.createElement("p");
    welcome.textContent = config.behaviour.welcomeMessage || "Hi! How can we help?";
    body.appendChild(welcome);

    var messages = document.createElement("div");
    messages.className = "ai-widget-messages";

    // sr-only status region (module spec §10: "Announce '<name> is
    // thinking' using aria-live") — a single shared node updated in place
    // rather than a live region per bubble, so restored history and polled
    // replies don't trigger noisy announcements of their own.
    var liveRegion = document.createElement("div");
    liveRegion.className = "ai-widget-sr-only";
    liveRegion.setAttribute("role", "status");
    liveRegion.setAttribute("aria-live", "polite");
    body.appendChild(liveRegion);

    var elements = { messages: messages, scrollContainer: body, restoreBanner: restoreBanner, liveRegion: liveRegion };

    if (config.behaviour.suggestedQuestions && config.behaviour.suggestedQuestions.length) {
      var suggested = document.createElement("div");
      suggested.className = "ai-widget-suggested";
      config.behaviour.suggestedQuestions.forEach(function (question) {
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = question;
        button.addEventListener("click", function () {
          sendMessageCoordinated(question, elements, config);
        });
        suggested.appendChild(button);
      });
      body.appendChild(suggested);
      // Only meaningful for a first-time visitor with nothing to reply to
      // yet — sendMessage removes this the moment the visitor sends their
      // own first message, and the session-restore branch below removes it
      // immediately for a returning visitor who already has a thread.
      elements.suggestedContainer = suggested;
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
    var sendLabel = document.createElement("span");
    sendLabel.className = "ai-widget-send-label";
    sendLabel.textContent = "Send";
    var sendSpinner = document.createElement("span");
    sendSpinner.className = "ai-widget-send-spinner";
    sendSpinner.setAttribute("aria-hidden", "true");
    sendButton.appendChild(sendLabel);
    sendButton.appendChild(sendSpinner);
    inputRow.appendChild(input);
    inputRow.appendChild(sendButton);
    panel.appendChild(inputRow);

    elements.input = input;
    elements.sendButton = sendButton;

    sendButton.addEventListener("click", function () {
      sendMessageCoordinated(input.value, elements, config);
    });
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMessageCoordinated(input.value, elements, config);
      }
    });
    // A draft the visitor was mid-way through typing survives navigation
    // too (module spec: "Draft message (if applicable)") — debounced so
    // every keystroke doesn't hit localStorage.
    input.addEventListener(
      "input",
      debounce(function () {
        saveSession(config, { draft: input.value });
      }, 400),
    );

    // Reading position within the transcript (module spec: "Save scroll
    // position whenever the conversation scrolls") — debounced for the
    // same reason the draft listener is.
    body.addEventListener(
      "scroll",
      debounce(function () {
        saveSession(config, { scrollTop: body.scrollTop });
      }, 150),
    );

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
    // Restoring the visitor's exact reading position (module spec:
    // "Restore the scroll position after the conversation history has
    // finished loading... Prevent jumpiness during restoration") needs
    // both "history has rendered" and "the panel is actually visible" to
    // be true — scrollTop set on a display:none subtree isn't reliable —
    // so this applies once, whichever of those two happens last.
    var savedScrollTop = null;
    var scrollRestoreApplied = false;
    function applyScrollRestoreIfReady() {
      if (scrollRestoreApplied || !panel.classList.contains("open")) return;
      scrollRestoreApplied = true;
      if (savedScrollTop !== null) {
        elements.scrollContainer.scrollTop = savedScrollTop;
      } else {
        scrollToBottom(elements.scrollContainer);
      }
    }

    launcher.addEventListener("click", function () {
      panel.classList.toggle("open");
      saveSession(config, { panelOpen: panel.classList.contains("open") });
      applyScrollRestoreIfReady();
    });

    root.appendChild(panel);
    root.appendChild(launcher);
    shadow.appendChild(style);
    shadow.appendChild(root);

    // Restore a still-active session from an earlier page on this same
    // site (module spec: "Automatically restore... The user should never
    // notice that the page changed") — conversationId, message history,
    // scroll position, draft text, in-flight typing state, and whether
    // the panel was left open. A missing or expired session (loadSession
    // returns null) falls through to the exact pre-existing fresh-visitor
    // behavior below.
    var restoredPanelOpen = false;
    var session = loadSession();
    if (session) {
      if (session.conversationId) {
        // A returning visitor with an active thread isn't a "first-time"
        // visitor — the quick-suggestion chips only make sense before any
        // conversation exists.
        if (elements.suggestedContainer && elements.suggestedContainer.parentNode) {
          elements.suggestedContainer.parentNode.removeChild(elements.suggestedContainer);
          elements.suggestedContainer = null;
        }
        state.conversationId = session.conversationId;
        savedScrollTop = typeof session.scrollTop === "number" ? session.scrollTop : null;
        restoreHistory(elements, config, session.conversationId, function (succeeded) {
          if (succeeded) {
            applyScrollRestoreIfReady();
            showWelcomeBackBanner(elements);
            if (session.pendingSince) {
              maybeResumePendingResponse(elements, config, session.pendingSince);
            }
          }
        });
      }
      if (session.draft) {
        input.value = session.draft;
      }
      if (session.panelOpen) {
        panel.classList.add("open");
        restoredPanelOpen = true;
      }
    }

    if (config.behaviour.autoOpen && !restoredPanelOpen) {
      var delay = (config.behaviour.autoOpenDelaySeconds || 0) * 1000;
      setTimeout(function () {
        panel.classList.add("open");
        applyScrollRestoreIfReady();
      }, delay);
    }

    handleStorageSync(elements, config);
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
