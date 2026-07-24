# Post-Launch Technical Debt — Widget SDK & Conversation Persistence

**Source:** Production readiness review of the embed SDK (`src/modules/widget/sdk-source.ts`) and its
supporting conversation-persistence system (`session-service.ts`, `execution-pipeline.ts`,
`public-messages.ts`, `rate-limit.ts`, widget behaviour settings), conducted before merging the
conversation-persistence branch.

**Scope note:** every item below was found during that specific review. This is not a full-application
audit — it does not claim coverage of modules outside the widget/conversation-persistence system. Two
bugs found during the same review (a broken "resume AI typing state" comparison, and a silently-droppable
first message when Web Locks rejects at runtime) were already fixed on that branch and are excluded here.

**How to use this doc:** each item is a standalone backlog entry — description, why it matters to the
business, why it matters to the visitor/admin using the widget, what happens if it's left alone, how big
the fix is, and when we think it should be scheduled. Nothing here has been implemented; this is planning
input only.

---

## Summary

| ID | Item | Category | Complexity | Sprint |
|---|---|---|---|---|
| P0-1 | iOS auto-zoom on message input | Mobile | Low | Pre-launch |
| P0-2 | No screen-reader announcement of new messages | Accessibility | Low | Pre-launch |
| P1-1 | Polling never stops when the panel is closed | Performance | Low | Sprint 1 |
| P1-2 | `resolveSession` insert has no conflict handling | Race condition | Medium | Sprint 1 |
| P1-3 | Send button stays enabled during first-message coordination wait | Race condition / UX | Low | Sprint 1 |
| P1-4 | Remaining accessibility gaps (launcher state, input label, focus management) | Accessibility | Medium | Sprint 1 |
| P2-1 | Rate-limiter bucket map grows unbounded | Memory / Ops | Low | Backlog |
| P2-2 | Rate limiting keyed on spoofable `X-Forwarded-For` | Security | Medium–High* | Backlog |
| P2-3 | Dead code: inert `scrollTop` assignment in `appendBubble` | Code quality | Low | Backlog |
| P2-4 | Scroll listener missing `{ passive: true }` | Performance | Low | Backlog |
| P2-5 | Duplicate message-rendering logic between `restoreHistory` and `startPolling` | Code quality | Low | Backlog |

*Real fix requires an infrastructure decision (edge/WAF layer), not just application code — see item detail.

---

## P0 — Must Fix Before Public Launch

These affect every visitor on a common path (mobile input, screen readers) or represent a broken core
guarantee. Both are cheap to fix relative to their impact.

### P0-1: iOS Safari auto-zooms the page when the message input is focused

- **Description:** `.ai-widget-input` is styled at `font-size: 13px`. iOS Safari automatically zooms the
  entire page in when a focused `<input>` has a font size under 16px — a well-known platform quirk, not a
  bug in this app, but one this CSS value triggers.
- **Business Impact:** First impression of the product, for a large share of traffic (mobile Safari is a
  major share of consumer web traffic), is a jarring, unrequested zoom the moment someone tries to use the
  core feature. Reflects poorly on both BloomAI and the customer's site it's embedded on.
- **User Impact:** Every iPhone/iPad visitor who taps the chat input gets the page suddenly zoomed in,
  often misaligning the widget panel with the viewport until they manually zoom back out. Directly
  disrupts the "seamless, ChatGPT-like" experience that was the explicit goal of the persistence work.
- **Technical Risk:** None — purely visual/UX, no data or correctness risk. Risk is entirely reputational
  (visible on literally the first interaction).
- **Estimated Complexity:** Low — raise `.ai-widget-input`'s `font-size` to `16px` (or `max(16px, ...)` if
  a smaller visual size is wanted with a `transform: scale()` trick). One CSS rule.
- **Recommended Sprint:** Pre-launch.

### P0-2: New messages are never announced to screen-reader users

- **Description:** `.ai-widget-messages` has no `role="log"` / `aria-live` region. When a reply streams
  in, a human agent's reply arrives via polling, or the typing indicator appears, none of it is announced
  by assistive technology — a screen-reader user has no way to know a reply has arrived without manually
  re-navigating into the transcript after the fact. (The new "welcome back" restore banner is the only
  `aria-live` region in the whole widget.)
- **Business Impact:** Real accessibility/legal exposure (WCAG 2.1 AA expects live regions for
  asynchronously-updating content like chat). BloomAI is a B2B product — customers embedding this widget
  on their own sites may have their own compliance obligations, and "our vendor's chat widget is
  unusable with a screen reader" is a credible complaint or lost-deal reason.
- **User Impact:** A screen-reader user attempting to use the widget effectively cannot use it as a
  conversational tool — they'd need to blindly re-explore the DOM after every message to find out whether
  anything happened.
- **Technical Risk:** None from fixing it; the current state is the risk (a core interaction path is
  effectively broken for one class of users).
- **Estimated Complexity:** Low — add `role="log"` and `aria-live="polite"` (or `aria-relevant="additions"`)
  to the `.ai-widget-messages` container. No structural change.
- **Recommended Sprint:** Pre-launch.

---

## P1 — First Post-Launch Sprint

Real, worth-fixing-soon issues, but none of them break the product for a typical visitor today — they're
either narrow-window races, invisible resource costs, or secondary accessibility polish beyond the P0
live-region fix.

### P1-1: Polling continues indefinitely even after the visitor closes the chat panel

- **Description:** `startPolling`'s `setInterval` (4s cadence) is never cleared once started, and nothing
  checks whether the panel is actually open. A visitor who sends one message and then closes the widget
  keeps generating a request to `/api/widget/conversations/:id/messages` every 4 seconds for the rest of
  the page's lifetime.
- **Business Impact:** Unnecessary backend load that scales with total widget installs × average page
  session length, not with actual engaged usage — a real, avoidable cost as the platform grows.
- **User Impact:** Continuous background network activity and (on mobile) battery drain the visitor never
  asked for and gets no benefit from, since they can't see replies while the panel is closed anyway.
- **Technical Risk:** Low on its own; compounds with scale (more installs, more idle-but-mounted widgets).
- **Estimated Complexity:** Low — stop the interval when the panel closes, restart (or resume) it when
  reopened; `startPolling`'s existing re-entrancy guard (`if (pollTimer || !state.conversationId) return;`)
  already makes restart-safe.
- **Recommended Sprint:** Sprint 1.

### P1-2: `resolveSession`'s find-or-create has no conflict handling

- **Description:** `session-service.ts`'s `resolveSession` does a `SELECT` then, if nothing is found, an
  `INSERT` — classic check-then-act. The database's unique index on `(widget_id, visitor_id)` prevents a
  duplicate *row* from ever existing, but the application code doesn't handle the resulting conflict: a
  genuinely simultaneous double-insert (same visitor, two tabs, no Web Locks support in one, both landing
  in the same narrow window) throws, which the SSE transport gracefully turns into a generic "Something
  went wrong, please try again" for one of the two tabs.
- **Business Impact:** Low-frequency but real support/trust cost — an occasional "please try again" on a
  feature explicitly built to prevent exactly this class of duplicate-session problem.
- **User Impact:** A visitor in the narrow affected window sees their first message fail and has to resend
  it manually — not data loss, not a crash, just a rough edge inconsistent with the "seamless" goal.
- **Technical Risk:** Increases in likelihood (not severity) with traffic volume and with the share of
  visitors on browsers without the Web Locks API. Bounded and self-healing (retry works), so not urgent,
  but worth closing before it becomes a recurring support ticket pattern.
- **Estimated Complexity:** Medium — needs a real decision (catch the Postgres unique-violation error code
  and re-`SELECT`, or use `ON CONFLICT DO NOTHING` + re-select, or wrap in a transaction) rather than a
  one-line fix, and touches server-side session-resolution code that's explicitly been treated as
  sensitive/protected in prior review rounds.
- **Recommended Sprint:** Sprint 1.

### P1-3: Send button stays enabled during the first-message coordination wait

- **Description:** When a tab loses the Web Locks race for the very first message, it waits up to ~2s
  (`waitForConversationId`) before actually sending. During that window, `sendMessageCoordinated`'s own
  top-of-function guard (`if (!trimmed || state.sending) return;`) doesn't block a second click, because
  `state.sending` isn't set until `sendMessage` itself actually runs — which hasn't happened yet. Nothing
  visibly happens for up to 2 seconds, which is exactly the situation that invites a visitor to click Send
  again.
- **Business Impact:** Minor — doesn't recreate the duplicate-conversation bug this feature exists to
  prevent (both sends resolve onto the same, correctly-shared conversation id), but is a small dent in the
  "feels instant" quality bar the persistence work was built around.
- **User Impact:** A visitor who double-clicks during the invisible wait window may see two of their own
  messages queued back-to-back instead of one.
- **Technical Risk:** None beyond the cosmetic duplicate-send; no data integrity issue.
- **Estimated Complexity:** Low — disable the send button synchronously at the top of
  `sendMessageCoordinated`, before entering the lock-wait branch, and re-enable it once `sendMessage`
  itself takes over (which already manages the same flag).
- **Recommended Sprint:** Sprint 1.

### P1-4: Remaining accessibility gaps beyond the P0 live-region fix

- **Description:** Three related, smaller a11y gaps: (1) the launcher button's `aria-label` is always
  "Open chat," never updated to reflect state or paired with `aria-expanded`; (2) the message `<input>`
  has a placeholder but no real `<label>`/`aria-label` (placeholders aren't a reliable label substitute for
  assistive tech); (3) opening the panel doesn't move keyboard focus into it, so keyboard/screen-reader
  users must manually tab to find it.
- **Business Impact:** Same category of risk as P0-2 (compliance posture, credibility with customers who
  have their own accessibility obligations), but each individual gap is a workaround-able rough edge
  rather than a fully broken path — hence P1, not P0.
- **User Impact:** Keyboard and screen-reader users can still use the widget, but with noticeably more
  friction than a sighted mouse user — unclear button state, unclear input purpose, manual navigation to
  find the panel after opening it.
- **Technical Risk:** None from fixing; low risk of regression since each change is additive
  (attributes/focus call, no restructuring).
- **Estimated Complexity:** Medium — three small, independent changes, but worth bundling into one pass
  with a real accessibility check (e.g. axe or manual screen-reader run) rather than three separate
  drive-by edits.
- **Recommended Sprint:** Sprint 1.

---

## P2 — Future Enhancements

Real findings, correctly de-prioritized: pre-existing, already-disclosed limitations, slow-burn concerns,
or pure code-quality cleanup with no user-facing effect.

### P2-1: Rate-limiter bucket map grows without bound

- **Description:** `rate-limit.ts`'s in-memory `Map` never evicts entries — every distinct
  `X-Forwarded-For` value that ever hits the public widget endpoints occupies a slot for the life of the
  server process. Already disclosed in the file's own doc comment as a known Phase-1 limitation.
- **Business Impact:** Slow-burn server memory growth on a public, unauthenticated, internet-facing
  endpoint. Realistically mitigated today by normal deploy/restart cadence, but worth closing before that
  stops being true.
- **User Impact:** None directly; a theoretical future OOM would affect all visitors of all widgets on
  that instance, but this is far from an imminent risk.
- **Technical Risk:** Low urgency, but the failure mode (gradual memory growth with no cap) is the kind of
  thing that's easy to forget until it's a production incident.
- **Estimated Complexity:** Low — periodic sweep of stale entries, or cap the map's size with LRU eviction.
- **Recommended Sprint:** Backlog.

### P2-2: Rate limiting is keyed on a client-suppliable header

- **Description:** `isRateLimited` keys off `x-forwarded-for`, which is attacker-controllable if the
  deployment doesn't normalize/strip it at the edge. A determined abuser could rotate fake values to evade
  the limit entirely, or impersonate a real visitor's IP to get them rate-limited. Already disclosed in
  CLAUDE.md as "not a substitute for a real edge/WAF-level limiter in production."
- **Business Impact:** Abuse-resistance gap for the public chat endpoint — a real cost driver if exploited
  (unlimited AI-provider spend against a single organization's widget).
- **User Impact:** None under normal use; only relevant under active abuse.
- **Technical Risk:** The actual fix isn't application code — it's an infrastructure decision (a real
  edge/WAF-level limiter, or normalizing the header at the load balancer). Flagging here so it's tracked
  as a launch-readiness item for whoever owns infra, not something engineering can close by editing this
  file alone.
- **Estimated Complexity:** Medium–High — depends entirely on the chosen infrastructure approach, not on
  in-repo code.
- **Recommended Sprint:** Backlog (owner: infra/platform, not app engineering).

### P2-3: Dead code — inert `scrollTop` assignment in `appendBubble`

- **Description:** `appendBubble` ends with `container.scrollTop = container.scrollHeight;`, but `container`
  is always `.ai-widget-messages`, which has no `overflow` set — the real scrollable element is its parent
  `.ai-widget-body`. This line has never had any visible effect; the SDK's actual scroll behavior is
  handled correctly elsewhere via `elements.scrollContainer`.
- **Business Impact:** None — purely cosmetic code cleanliness.
- **User Impact:** None.
- **Technical Risk:** Low, but misleading to a future reader who might assume it does something.
- **Estimated Complexity:** Low — delete one line.
- **Recommended Sprint:** Backlog.

### P2-4: Scroll listener missing `{ passive: true }`

- **Description:** The `scroll` listener on `.ai-widget-body` (used to persist reading position) doesn't
  mark itself passive, even though it never calls `preventDefault()`.
- **Business Impact:** None measurable.
- **User Impact:** None measurable — modern browsers already optimize most scroll listeners; this is a
  best-practice hint, not a fix for an observed problem.
- **Technical Risk:** None.
- **Estimated Complexity:** Low — add `{ passive: true }` to the listener options.
- **Recommended Sprint:** Backlog.

### P2-5: Duplicate-shaped message-rendering logic between `restoreHistory` and `startPolling`

- **Description:** Both functions independently iterate a message list, update `state.lastMessageAt`,
  dedupe via `state.seenMessageIds`, and append bubbles — structurally similar but not identical (the
  restore path renders both roles with real historical timestamps; the poll path only ever renders new
  assistant replies). A shared helper could reduce the duplication, but the behavioral differences make a
  forced extraction non-trivial.
- **Business Impact:** None directly — this is a maintainability observation, not a functional gap.
- **User Impact:** None.
- **Technical Risk:** Low — the main risk of *not* refactoring is that a future bug fix gets applied to
  one copy and not the other; worth a look next time either function needs to change anyway rather than as
  a standalone project.
- **Estimated Complexity:** Low–Medium — a real refactor, not a one-liner, given the role/timestamp
  differences between the two call sites.
- **Recommended Sprint:** Backlog — bundle with the next change that touches either function, rather than
  scheduling standalone.
