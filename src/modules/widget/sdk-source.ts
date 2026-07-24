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

  function appendBubble(container, role, config, timestamp) {
    var bubble = document.createElement("div");
    bubble.className = "ai-widget-bubble ai-widget-bubble-" + role;

    var textEl = document.createElement("span");
    textEl.className = "ai-widget-bubble-text";
    bubble.appendChild(textEl);

    if (config.behaviour.showTimestamp) {
      var time = document.createElement("span");
      time.className = "ai-widget-bubble-time";
      time.textContent = (timestamp || new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
    saveSession(config, { draft: "", pendingSince: new Date().toISOString() });
    elements.sendButton.disabled = true;

    appendBubble(elements.messages, "user", config).textEl.textContent = trimmed;
    var assistant = appendBubble(elements.messages, "assistant", config);
    scrollToBottom(elements.scrollContainer);
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
            saveSession(config, { conversationId: state.conversationId });
          } else if (event.type === "token") {
            assistant.root.classList.remove("ai-widget-typing");
            assistant.raw += event.text;
            renderAssistantText(assistant.textEl, assistant.raw);
            scrollToBottom(elements.scrollContainer);
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
        saveSession(config, { conversationId: state.conversationId, pendingSince: null });
        state.sending = false;
        elements.sendButton.disabled = false;
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

    return fetch(url, { credentials: "omit" })
      .then(function (response) {
        return response.ok ? response.json() : { messages: [] };
      })
      .then(function (data) {
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
    scrollToBottom(elements.scrollContainer);

    var seenCountAtStart = Object.keys(state.seenMessageIds).length;
    var deadline = Date.now() + (PENDING_TIMEOUT_MS - elapsedMs);

    var watcher = setInterval(function () {
      if (Object.keys(state.seenMessageIds).length > seenCountAtStart) {
        clearInterval(watcher);
        if (typingBubble.root.parentNode) typingBubble.root.parentNode.removeChild(typingBubble.root);
        saveSession(config, { pendingSince: null });
        return;
      }
      if (Date.now() >= deadline) {
        clearInterval(watcher);
        typingBubble.root.classList.remove("ai-widget-typing");
        typingBubble.root.classList.add("ai-widget-error");
        typingBubble.textEl.textContent =
          config.behaviour.offlineMessage || "This response could not be completed. Please try again.";
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
      ".ai-widget-header { background: var(--ai-widget-primary); color: #fff; padding: 16px; font-weight: 600; }",
      ".ai-widget-body { position: relative; flex: 1; padding: 16px; overflow-y: auto; color: #111; font-size: 14px; }",
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
    var elements = { messages: messages, scrollContainer: body, restoreBanner: restoreBanner };

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
