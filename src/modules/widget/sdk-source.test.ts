import { describe, expect, it } from "vitest";
import { WIDGET_SDK_SOURCE } from "./sdk-source";

describe("WIDGET_SDK_SOURCE", () => {
  it("reads the public key from the script tag and fetches the public config endpoint", () => {
    expect(WIDGET_SDK_SOURCE).toContain("data-widget-key");
    expect(WIDGET_SDK_SOURCE).toContain("/api/widget/config?key=");
  });

  it("sends messages to the conversation engine's public endpoint and reads the response as a stream", () => {
    expect(WIDGET_SDK_SOURCE).toContain("/api/widget/messages");
    expect(WIDGET_SDK_SOURCE).toContain("response.body");
    expect(WIDGET_SDK_SOURCE).toContain("getReader");
  });

  it("persists a stable, client-generated visitor id rather than a server-issued credential", () => {
    expect(WIDGET_SDK_SOURCE).toContain("localStorage");
    expect(WIDGET_SDK_SOURCE).toContain("visitorId");
  });

  it("polls for new messages (e.g. a human agent's Inbox reply) via a plain GET, not a WebSocket", () => {
    expect(WIDGET_SDK_SOURCE).toContain("/api/widget/conversations/");
    expect(WIDGET_SDK_SOURCE).toContain("/messages?key=");
    expect(WIDGET_SDK_SOURCE).toContain("setInterval");
  });

  it("dedupes polled messages against ones it already rendered itself", () => {
    expect(WIDGET_SDK_SOURCE).toContain("seenMessageIds");
  });

  it("does not start polling until the current turn's own stream has finished", () => {
    // Regression test: starting polling on "ready" (the moment the request
    // begins) raced against execution-pipeline.ts marking the assistant
    // message status='complete' in the database *before* the "done" SSE
    // event (which records the id in seenMessageIds) reaches the browser —
    // a poll landing in that window rendered the same reply a second time.
    // Polling must start only after the stream resolves, so any message it
    // finds afterward is one the widget didn't already render.
    const readyBranch = WIDGET_SDK_SOURCE.match(/event\.type === "ready"\)\s*\{([\s\S]*?)\}\s*else/);
    expect(readyBranch).not.toBeNull();
    expect(readyBranch![1]).not.toContain("startPolling");

    const readyIndex = WIDGET_SDK_SOURCE.indexOf('event.type === "ready"');
    const doneIndex = WIDGET_SDK_SOURCE.indexOf('event.type === "done"');
    const pollStartIndex = WIDGET_SDK_SOURCE.indexOf("startPolling(elements, config);");
    expect(readyIndex).toBeGreaterThan(-1);
    expect(doneIndex).toBeGreaterThan(readyIndex);
    expect(pollStartIndex).toBeGreaterThan(doneIndex);
  });

  it("skips a poll tick while a later message's own stream is in flight", () => {
    // Regression test: startPolling() begins only after the *first*
    // message's stream resolves, but the interval it starts keeps running
    // for the rest of the session — including while a *second, third, ...*
    // message is streaming. A poll tick landing in the same window the
    // first-message fix was written for (after the DB write, before the
    // client processes "done") would render that later reply twice. The
    // interval callback must bail out early while state.sending is true.
    const intervalBody = WIDGET_SDK_SOURCE.match(
      /pollTimer = setInterval\(function \(\) \{([\s\S]*?)\}, POLL_INTERVAL_MS\)/,
    );
    expect(intervalBody).not.toBeNull();
    const guardIndex = intervalBody![1].indexOf("if (state.sending) return;");
    const urlIndex = intervalBody![1].indexOf("var url =");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(urlIndex).toBeGreaterThan(guardIndex);
  });

  it("handles the handoff event (Human Takeover) without treating it as an error", () => {
    expect(WIDGET_SDK_SOURCE).toContain('"handoff"');
  });

  it("never references a service key, secret, or database credential", () => {
    const forbidden = ["SUPABASE_SERVICE_ROLE", "DATABASE_URL", "service_role", "secret", "organizationId"];
    for (const term of forbidden) {
      expect(WIDGET_SDK_SOURCE.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it("never talks to a vendor AI API directly — only this app's own backend", () => {
    for (const term of ["api.openai.com", "api.anthropic.com", "generativelanguage.googleapis.com"]) {
      expect(WIDGET_SDK_SOURCE.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it("never opens a WebSocket (module spec: SSE only)", () => {
    expect(WIDGET_SDK_SOURCE).not.toContain("WebSocket");
    expect(WIDGET_SDK_SOURCE).not.toContain("new EventSource");
  });

  it("is a self-invoking function (safe to drop into any page via a script tag)", () => {
    expect(WIDGET_SDK_SOURCE.trim().startsWith("(function () {")).toBe(true);
    expect(WIDGET_SDK_SOURCE.trim().endsWith("})();")).toBe(true);
  });

  describe("conversation persistence across page navigation", () => {
    it("persists the conversation id, draft text, and panel-open state under a per-widget-key localStorage entry", () => {
      expect(WIDGET_SDK_SOURCE).toContain('"ai_widget_session_" + publicKey');
      expect(WIDGET_SDK_SOURCE).toContain("function saveSession(");
      expect(WIDGET_SDK_SOURCE).toContain("function loadSession(");
    });

    it("saves the conversation id the moment the server assigns one, before the reply finishes streaming", () => {
      // Regression: if this only happened after the whole turn completed, a
      // visitor who navigates away mid-reply would still lose the
      // conversation id and get a duplicate conversation next page load.
      const readyBranch = WIDGET_SDK_SOURCE.match(/event\.type === "ready"\)\s*\{([\s\S]*?)\}\s*else/);
      expect(readyBranch).not.toBeNull();
      expect(readyBranch![1]).toContain("saveSession(config, { conversationId: state.conversationId });");
    });

    it("clears the persisted draft as soon as a message is actually sent", () => {
      const sendMessageStart = WIDGET_SDK_SOURCE.indexOf("function sendMessage(text, elements, config)");
      const clearDraftIndex = WIDGET_SDK_SOURCE.indexOf('saveSession(config, { draft: "", pendingSince:', sendMessageStart);
      const fetchIndex = WIDGET_SDK_SOURCE.indexOf("fetch(apiBase +", sendMessageStart);
      expect(clearDraftIndex).toBeGreaterThan(sendMessageStart);
      expect(clearDraftIndex).toBeLessThan(fetchIndex);
    });

    it("never caches message content client-side — the persisted session only points at a conversation id", () => {
      // Restoration always re-fetches the transcript from the server
      // (source of truth); the localStorage payload stays a small pointer,
      // not a second, driftable copy of the conversation.
      const saveSessionBody = WIDGET_SDK_SOURCE.match(/function saveSession\(config, patch\) \{([\s\S]*?)\n  \}/);
      expect(saveSessionBody).not.toBeNull();
      expect(saveSessionBody![1]).toContain("conversationId");
      expect(saveSessionBody![1]).toContain("draft");
      expect(saveSessionBody![1]).toContain("panelOpen");
      expect(saveSessionBody![1]).not.toContain("messages:");
      expect(saveSessionBody![1]).not.toContain("seenMessageIds");
    });

    it("treats a session past its configurable expiry as absent, rather than reusing a stale conversation", () => {
      expect(WIDGET_SDK_SOURCE).toContain("parsed.expiresAt");
      expect(WIDGET_SDK_SOURCE).toContain("new Date(parsed.expiresAt).getTime() <= Date.now()");
      expect(WIDGET_SDK_SOURCE).toContain("sessionTimeoutMinutes");
    });

    it("restores the conversation id, history, draft, and panel-open state on init, before falling back to autoOpen", () => {
      const restoreIndex = WIDGET_SDK_SOURCE.indexOf("var session = loadSession();");
      const autoOpenIndex = WIDGET_SDK_SOURCE.indexOf("if (config.behaviour.autoOpen && !restoredPanelOpen)");
      expect(restoreIndex).toBeGreaterThan(-1);
      expect(autoOpenIndex).toBeGreaterThan(restoreIndex);
    });

    it("restores full conversation history from the server rather than trusting anything cached locally", () => {
      expect(WIDGET_SDK_SOURCE).toContain("function restoreHistory(elements, config, conversationId, onRendered)");
      // No `after` cursor on the restore fetch — it deliberately asks for
      // the complete transcript, unlike the polling loop's incremental one.
      const restoreFn = WIDGET_SDK_SOURCE.match(
        /function restoreHistory\(elements, config, conversationId, onRendered\) \{([\s\S]*?)\n  \}\n\n  \/\/ Resumes waiting/,
      );
      expect(restoreFn).not.toBeNull();
      expect(restoreFn![1]).not.toContain("&after=");
    });

    it("starts polling immediately after a restore, not gated behind the visitor sending a first message on this page", () => {
      const restoreFn = WIDGET_SDK_SOURCE.match(
        /function restoreHistory\([\s\S]*?\n  \}\n\n  \/\/ Resumes waiting/,
      );
      expect(restoreFn).not.toBeNull();
      expect(restoreFn![0]).toContain("startPolling(elements, config);");
    });

    it("reuses the restored conversation id on the next message rather than starting a new one", () => {
      // sendMessage already sends state.conversationId when present; the
      // fix is entirely that state.conversationId now gets populated from
      // a restored session, not a change to the send path itself.
      expect(WIDGET_SDK_SOURCE).toContain("state.conversationId = session.conversationId;");
      expect(WIDGET_SDK_SOURCE).toContain("conversationId: state.conversationId || undefined");
    });

    it("synchronizes conversation state across browser tabs via the storage event", () => {
      expect(WIDGET_SDK_SOURCE).toContain('window.addEventListener("storage"');
      expect(WIDGET_SDK_SOURCE).toContain("function handleStorageSync(elements, config)");
    });

    it("never lets a tab that already owns a conversation get switched to a different tab's conversation", () => {
      const handler = WIDGET_SDK_SOURCE.match(/function handleStorageSync\(elements, config\) \{([\s\S]*?)\n  \}/);
      expect(handler).not.toBeNull();
      expect(handler![1]).toContain("state.conversationId) return;");
    });
  });

  describe("scroll position restore", () => {
    it("saves scroll position on scroll and distinguishes 'never recorded' from a legitimate 0 (scrolled to top)", () => {
      expect(WIDGET_SDK_SOURCE).toContain('body.addEventListener(\n      "scroll"');
      expect(WIDGET_SDK_SOURCE).toContain("saveSession(config, { scrollTop: body.scrollTop });");
      const saveSessionBody = WIDGET_SDK_SOURCE.match(/function saveSession\(config, patch\) \{([\s\S]*?)\n  \}/);
      expect(saveSessionBody).not.toBeNull();
      expect(saveSessionBody![1]).toContain("existing.scrollTop !== undefined");
    });

    it("restores scroll position only once history has rendered and the panel is actually visible", () => {
      expect(WIDGET_SDK_SOURCE).toContain("function applyScrollRestoreIfReady()");
      const fn = WIDGET_SDK_SOURCE.match(/function applyScrollRestoreIfReady\(\) \{([\s\S]*?)\n    \}/);
      expect(fn).not.toBeNull();
      expect(fn![1]).toContain('!panel.classList.contains("open")');
    });

    it("falls back to scrolling to the latest message when there is no saved position, or restoration fails", () => {
      expect(WIDGET_SDK_SOURCE).toContain("scrollToBottom(elements.scrollContainer);");
      const restoreCatch = WIDGET_SDK_SOURCE.match(/\.catch\(function \(\) \{([\s\S]*?fetch failed[\s\S]*?)\}\);/);
      expect(restoreCatch).not.toBeNull();
      expect(restoreCatch![1]).toContain("scrollToBottom(elements.scrollContainer);");
    });

    it("only auto-scrolls to newly polled messages when the visitor was already near the bottom", () => {
      const pollThen = WIDGET_SDK_SOURCE.match(/\.then\(function \(data\) \{([\s\S]*?)\}\)\s*\.catch/);
      expect(pollThen).not.toBeNull();
      expect(pollThen![1]).toContain("var wasNearBottom = isNearBottom(elements.scrollContainer);");
      expect(pollThen![1]).toContain("if (wasNearBottom) scrollToBottom(elements.scrollContainer);");
    });

    it("scrolls to the actual scrollable container, not the non-scrolling messages list", () => {
      // Regression: the pre-existing token-handler scroll call targeted
      // elements.messages, which has no overflow set (the real scrollable
      // element is the .ai-widget-body it's nested inside) — a no-op that
      // never actually followed a live streaming reply.
      expect(WIDGET_SDK_SOURCE).toContain("scrollContainer: body");
      expect(WIDGET_SDK_SOURCE).not.toContain("elements.messages.scrollTop = elements.messages.scrollHeight;");
    });
  });

  describe("resumed AI typing state", () => {
    it("persists when a reply is put in flight and clears it once resolved", () => {
      expect(WIDGET_SDK_SOURCE).toContain("pendingSince: new Date().toISOString()");
      expect(WIDGET_SDK_SOURCE).toContain(
        "saveSession(config, { conversationId: state.conversationId, pendingSince: null });",
      );
    });

    it("never sends a new POST when resuming — only reads via the existing polling/history endpoints", () => {
      const fn = WIDGET_SDK_SOURCE.match(
        /function maybeResumePendingResponse\(elements, config, pendingSince\) \{([\s\S]*?)\n  \}/,
      );
      expect(fn).not.toBeNull();
      expect(fn![1]).not.toContain("fetch(apiBase + \"/api/widget/messages\"");
      expect(fn![1]).not.toContain('method: "POST"');
    });

    it("skips resuming when the reply already arrived before this page finished restoring", () => {
      const fn = WIDGET_SDK_SOURCE.match(
        /function maybeResumePendingResponse\(elements, config, pendingSince\) \{([\s\S]*?)\n  \}/,
      );
      expect(fn).not.toBeNull();
      expect(fn![1]).toContain("if (lastKnownAssistantTime >= pendingTime)");
    });

    it("compares against the assistant's own reply timestamp, not just any message — the visitor's own just-sent message would otherwise always satisfy an 'already arrived' check", () => {
      // Regression: an earlier version compared pendingSince against
      // state.lastMessageAt (every role), which the visitor's own message
      // always satisfies immediately — the typing indicator would almost
      // never actually show.
      expect(WIDGET_SDK_SOURCE).toContain("state.lastAssistantMessageAt = message.createdAt;");
      const fn = WIDGET_SDK_SOURCE.match(
        /function maybeResumePendingResponse\(elements, config, pendingSince\) \{([\s\S]*?)\n  \}/,
      );
      expect(fn).not.toBeNull();
      expect(fn![1]).not.toContain("state.lastMessageAt ? new Date(state.lastMessageAt)");
    });

    it("gives up after the configurable timeout rather than waiting forever", () => {
      expect(WIDGET_SDK_SOURCE).toContain("var PENDING_TIMEOUT_MS = 45000;");
      const fn = WIDGET_SDK_SOURCE.match(
        /function maybeResumePendingResponse\(elements, config, pendingSince\) \{([\s\S]*?)\n  \}/,
      );
      expect(fn).not.toBeNull();
      expect(fn![1]).toContain("Date.now() >= deadline");
    });

    it("reuses the existing typing-indicator styling rather than a hardcoded, non-white-label response string", () => {
      // "Bloom AI" is one tenant's brand name in a multi-tenant product —
      // hardcoding it into the SDK every org's widget shares would be a
      // real bug, not just a style choice.
      expect(WIDGET_SDK_SOURCE).not.toContain("Bloom AI");
      const fn = WIDGET_SDK_SOURCE.match(
        /function maybeResumePendingResponse\(elements, config, pendingSince\) \{([\s\S]*?)\n  \}/,
      );
      expect(fn).not.toBeNull();
      expect(fn![1]).toContain('typingBubble.root.classList.add("ai-widget-typing");');
    });
  });

  describe("welcome-back banner", () => {
    it("is shown only after a successful restoration, and auto-hides", () => {
      const callback = WIDGET_SDK_SOURCE.match(/restoreHistory\(elements, config, session\.conversationId, function \(succeeded\) \{([\s\S]*?)\}\);/);
      expect(callback).not.toBeNull();
      expect(callback![1]).toContain("if (succeeded) {");
      expect(callback![1]).toContain("showWelcomeBackBanner(elements);");

      const fn = WIDGET_SDK_SOURCE.match(/function showWelcomeBackBanner\(elements\) \{([\s\S]*?)\n  \}/);
      expect(fn).not.toBeNull();
      expect(fn![1]).toContain("setTimeout(function () {");
      expect(fn![1]).toContain("}, 3000);");
    });

    it("is accessible (announced politely) and never called from the cross-tab adoption path", () => {
      expect(WIDGET_SDK_SOURCE).toContain('restoreBanner.setAttribute("role", "status");');
      expect(WIDGET_SDK_SOURCE).toContain('restoreBanner.setAttribute("aria-live", "polite");');

      const crossTabHandler = WIDGET_SDK_SOURCE.match(/function handleStorageSync\(elements, config\) \{([\s\S]*?)\n  \}/);
      expect(crossTabHandler).not.toBeNull();
      expect(crossTabHandler![1]).not.toContain("showWelcomeBackBanner");
    });
  });

  describe("cross-tab first-message coordination", () => {
    it("only coordinates the first message of a fresh conversation — every later send is untouched", () => {
      expect(WIDGET_SDK_SOURCE).toContain("function sendMessageCoordinated(text, elements, config)");
      const fn = WIDGET_SDK_SOURCE.match(
        /function sendMessageCoordinated\(text, elements, config\) \{([\s\S]*?)\n  \}/,
      );
      expect(fn).not.toBeNull();
      expect(fn![1]).toContain("if (state.conversationId ||");
    });

    it("uses the Web Locks API when available, and degrades gracefully when it is not", () => {
      expect(WIDGET_SDK_SOURCE).toContain("window.navigator.locks");
      expect(WIDGET_SDK_SOURCE).toContain(".request(");
      expect(WIDGET_SDK_SOURCE).toContain("window.navigator && window.navigator.locks && window.navigator.locks.request");
      const fn = WIDGET_SDK_SOURCE.match(
        /function sendMessageCoordinated\(text, elements, config\) \{([\s\S]*?)\n  \}/,
      );
      expect(fn).not.toBeNull();
      // No-support branch still calls the real sendMessage — it never
      // silently drops the visitor's message.
      expect(fn![1]).toContain("sendMessage(text, elements, config);\n      return;");
    });

    it("holds the lock only until this tab's own conversation id is known, never for the whole reply", () => {
      const fn = WIDGET_SDK_SOURCE.match(
        /function sendMessageCoordinated\(text, elements, config\) \{([\s\S]*?)\n  \}/,
      );
      expect(fn).not.toBeNull();
      expect(fn![1]).toContain("return waitForConversationId();");
    });

    it("the losing tab adopts the winning tab's conversation id instead of creating its own", () => {
      const fn = WIDGET_SDK_SOURCE.match(
        /function sendMessageCoordinated\(text, elements, config\) \{([\s\S]*?)\n  \}/,
      );
      expect(fn).not.toBeNull();
      expect(fn![1]).toContain("if (!lock) {");
      const lockIndex = fn![1].indexOf("if (!lock) {");
      const waitIndex = fn![1].indexOf("waitForConversationId().then(function () {", lockIndex);
      const sendIndex = fn![1].indexOf("sendMessage(text, elements, config);", waitIndex);
      expect(waitIndex).toBeGreaterThan(lockIndex);
      expect(sendIndex).toBeGreaterThan(waitIndex);
    });

    it("never silently drops the visitor's message if the Web Locks request itself rejects (e.g. a Permissions-Policy blocking it)", () => {
      const fn = WIDGET_SDK_SOURCE.match(
        /function sendMessageCoordinated\(text, elements, config\) \{([\s\S]*?)\n  \}/,
      );
      expect(fn).not.toBeNull();
      const catchBranch = fn![1].match(/\.catch\(function \(\) \{([\s\S]*?)\}\);/);
      expect(catchBranch).not.toBeNull();
      expect(catchBranch![1]).toContain("sendMessage(text, elements, config);");
    });

    it("the coordination wait is bounded and purely local (no network requests)", () => {
      const fn = WIDGET_SDK_SOURCE.match(/function waitForConversationId\(\) \{([\s\S]*?)\n  \}/);
      expect(fn).not.toBeNull();
      expect(fn![1]).not.toContain("fetch(");
      expect(fn![1]).toContain("attempts >= 20");
    });

    it("every call site sends through the coordinated entry point, not the raw sendMessage", () => {
      const clickHandlers = WIDGET_SDK_SOURCE.match(/sendMessageCoordinated\(/g) || [];
      // suggested-question button, the send button, and Enter-to-send.
      expect(clickHandlers.length).toBeGreaterThanOrEqual(3);
    });
  });
});
