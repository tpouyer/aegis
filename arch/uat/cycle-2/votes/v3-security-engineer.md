# V3: Security Engineer Ballot -- Cycle 2

## enhance-error-recovery-ux.md
- **Verdict**: APPROVE*
- **Reasoning**: The error recovery improvements are sound and the auth expiry detection in `resilientFetch`/clients is a security improvement -- surfacing expired token states gracefully prevents users from unknowingly operating in a degraded state. The approach of detecting 401 responses and clearing stale metadata is correct. No new attack surface introduced.
- **Conditions**: Error banners must not leak raw API response bodies, headers, or token metadata to the DOM. Sanitize error messages to user-friendly strings before rendering. The retry mechanism must not replay requests with potentially stale credentials without re-validating auth state first.

## enhance-keyboard-navigation-and-accessibility.md
- **Verdict**: APPROVE
- **Reasoning**: This is a large accessibility-focused proposal that adds ARIA attributes, keyboard handlers, and semantic HTML. None of the changes touch auth paths, token handling, or data flows. The card context menu "Transition to" feature calls existing Jira transition APIs through the already-auth-gated client. No security concerns.
- **Conditions**: None.

## enhance-progressive-auth-nudges.md
- **Verdict**: APPROVE*
- **Reasoning**: This proposal wires up the existing OAuth flows to the UI and adds the callback route -- critical functionality that is currently completely broken. The security architecture (PKCE, state parameter, tokens in SW only) is already implemented in the auth modules; this proposal just connects UI buttons to those functions. However, the callback route is a sensitive new surface.
- **Conditions**: The callback route MUST validate the `state` parameter against the value stored in sessionStorage before exchanging the code. If `state` does not match, the flow must be aborted and no token exchange attempted (CSRF protection). The `code` parameter must not be logged or persisted beyond the exchange. After token exchange, clear the `code` and `state` from the URL (use `history.replaceState`) to prevent leakage via Referer headers or browser history. Ensure the redirect-back URL (from sessionStorage) is validated as a relative path to prevent open redirect attacks.

## enhance-responsive-layout-and-performance.md
- **Verdict**: APPROVE*
- **Reasoning**: Primarily a performance and responsive layout proposal. The cache eviction scheduler and SW cache size limits are positive from a security perspective -- unbounded caches can store sensitive API responses indefinitely. The streaming performance changes (mutable refs, debounced persistence) do not affect auth. Route-level code splitting does not introduce new risks.
- **Conditions**: The cache eviction scheduler must ensure that token-related data and auth metadata cached in IndexedDB are also subject to eviction when expired. The SW cache size limit (100 entries, LRU) must not inadvertently evict critical auth-related resources. Chat session persistence must not persist raw API keys or tokens -- verify the debounced `persistSession()` only saves message content, not provider credentials.

## enhance-responsive-layout.md
- **Verdict**: APPROVE
- **Reasoning**: A simpler responsive layout proposal that creates a Zustand store for sidebar state and adds Tailwind breakpoint classes. The command palette sidebar toggle replacement (DOM manipulation to Zustand) is a minor improvement. No auth, token, or data flow changes. No security impact.
- **Conditions**: None.

## enhance-structured-error-recovery-and-auth-resilience.md
- **Verdict**: APPROVE*
- **Reasoning**: This is the most security-relevant enhancement proposal. The error classification layer, SW token expiry checking, AuthManager token refresh stub upgrade, global 401 interceptor, and enhanced toast system all directly improve security posture. Preventing stale token injection in the SW is a critical fix. The `aegis:auth-expired` custom event and `ClassifiedError` pattern are well-designed. Replacing `window.location.href` with client-side navigation prevents state loss. This proposal strengthens the auth boundary significantly.
- **Conditions**: (1) The `ClassifiedError` type must NOT include raw response bodies or headers in any field that gets rendered to the DOM -- only the classification and a sanitized message. (2) The SW expiry check must use a timing-safe comparison and include the 60s buffer already present in `AuthManager.isTokenExpired()`. (3) The `clearToken()` method must clear both localStorage metadata AND notify the SW to drop the token from its in-memory Map -- partial cleanup creates inconsistent auth state. (4) AUTH_EXPIRED toast "Re-authenticate" buttons must call the existing `initiate*Auth()` functions, not implement new auth flows. (5) Error history/persistence (if implemented) must not store sensitive request details (auth headers, tokens, full URLs with query params).

## fix-a11y-fundamentals.md
- **Verdict**: APPROVE
- **Reasoning**: Pure accessibility fixes -- skip links, page titles, heading hierarchy, ARIA labels, and priority indicator improvements. No auth, data, or API changes. No security concerns whatsoever.
- **Conditions**: None.

## fix-abort-signal-providers.md
- **Verdict**: APPROVE
- **Reasoning**: Passing `AbortSignal` to fetch calls in Vertex AI, Ollama, and Custom providers is a straightforward resource management fix. Aborting HTTP connections on user cancellation prevents unnecessary token usage against rate-limited APIs. The `this.endpoint` to `this.relayUrl` fix in the error message is cosmetic. No security risk -- signals are already part of the fetch API contract.
- **Conditions**: None.

## fix-auth-wiring.md
- **Verdict**: APPROVE*
- **Reasoning**: This is functionally equivalent to `enhance-progressive-auth-nudges.md` but scoped more narrowly to just wiring the OAuth buttons and adding the callback route. Same security analysis applies. The existing auth implementation is PKCE-based with proper state parameters. The callback route is the critical new surface.
- **Conditions**: Same as `enhance-progressive-auth-nudges.md`: (1) Validate `state` parameter against sessionStorage before code exchange (CSRF protection). (2) Do not log or persist the authorization `code`. (3) Clear `code` and `state` from URL after exchange via `history.replaceState`. (4) Validate the post-auth redirect URL is a relative path (prevent open redirect). (5) The Atlassian accessible-resources API call to get `cloudId` must use the freshly obtained token, not a cached/stale one.

## fix-board-default-id.md
- **Verdict**: APPROVE
- **Reasoning**: Fixes the `'default'` board ID handling to show an auth-required empty state instead of a NaN error. The proposal correctly checks auth status before loading board data. No new API calls or auth changes -- just routing logic. The board picker (if implemented) would use existing authenticated Jira client calls.
- **Conditions**: None.

## fix-card-focus-indicator.md
- **Verdict**: APPROVE
- **Reasoning**: Adds visual focus ring and ARIA attributes to board cards for keyboard navigation visibility. Purely presentational and accessibility-focused. No auth, data flow, or API changes.
- **Conditions**: None.

## fix-chat-textarea-label.md
- **Verdict**: APPROVE
- **Reasoning**: Adds `aria-label` to the chat textarea and `aria-activedescendant` to the command palette input. Purely accessibility attributes with zero security implications.
- **Conditions**: None.

## fix-double-text-filter.md
- **Verdict**: APPROVE
- **Reasoning**: Removes duplicate client-side text filtering that conflicts with server-side JQL filtering. This is a logic fix in a single component (`BoardView.tsx`). No auth or security paths are affected. The JQL query construction in `buildFilterJql` is unchanged.
- **Conditions**: None.

## fix-escape-stop-streaming.md
- **Verdict**: APPROVE
- **Reasoning**: Wires the existing `aegis:stop-streaming` custom event to the abort controller in ChatView. The abort signal is already created and managed; this just connects the keyboard shortcut to it. No security implications -- aborting a streaming LLM response is a benign operation.
- **Conditions**: None.

## fix-priority-indicator.md
- **Verdict**: APPROVE
- **Reasoning**: Replaces a color-only 2x2px dot with a text+color badge for WCAG compliance. Pure presentation change on data already rendered. No security impact.
- **Conditions**: None.

## fix-provider-switch.md
- **Verdict**: APPROVE*
- **Reasoning**: Fixes provider switching mid-session by calling `switchProvider` instead of `createSession`. The change is localized to ChatView's callback handler. The security consideration is that switching providers might involve different auth requirements (e.g., from Ollama with no auth to Vertex AI requiring Google OAuth).
- **Conditions**: After switching provider, the system must verify that the user has valid credentials for the new provider before sending messages. If the new provider requires auth that the user lacks, the appropriate auth-required state should be shown rather than silently failing or sending requests without proper authentication.

## fix-responsive-layout.md
- **Verdict**: APPROVE
- **Reasoning**: Adds responsive breakpoints, hamburger menu, and Zustand-based sidebar state. Replaces DOM manipulation with React state management. No auth or security code is modified. The Zustand store only holds UI layout state (boolean flags).
- **Conditions**: None.

## fix-sidebar-board-navigation.md
- **Verdict**: APPROVE
- **Reasoning**: Standardizes the board ID to `'1'` across sidebar, landing page, and keyboard shortcut. Pure navigation routing fix with no auth or security implications. The board route's NaN handling is a UX issue, not a security issue.
- **Conditions**: None.

## fix-skip-nav-headings.md
- **Verdict**: APPROVE
- **Reasoning**: Adds skip navigation link, dynamic page titles, and fixes heading hierarchy. Pure accessibility improvements with no security surface changes.
- **Conditions**: None.

## fix-theme-state-consolidation.md
- **Verdict**: APPROVE
- **Reasoning**: Consolidates theme state into a single Zustand store, replacing three independent implementations. The store only manages a boolean `isDark` flag and a CSS class toggle. The `localStorage` key used (`aegis_theme`) stores only `'dark'` or `'light'`. No auth or sensitive data involved.
- **Conditions**: None.

## fix-token-expiry-handling.md
- **Verdict**: APPROVE*
- **Reasoning**: This is a critical security fix. Currently, the Service Worker blindly injects expired tokens, and `isConnected()` can return true with stale metadata. This proposal adds expiry checking at three layers: AuthManager, Service Worker, and resilientFetch. The phased approach (detect and surface now, implement refresh later) is pragmatic. The existing `isTokenExpired()` method already includes a 60-second buffer for clock skew, which is good.
- **Conditions**: (1) The SW must delete expired tokens from its in-memory `tokens` Map immediately upon detection -- do not leave stale tokens accessible. (2) The structured error response from the SW (`{ error: 'token_expired', provider }`) must use a proper HTTP 401 status code so it is not confused with a successful response. (3) The `AuthExpiredError` class must be distinct from generic errors so that catch blocks can differentiate between "re-auth needed" and "something else broke" -- do not overload generic Error. (4) When clearing stale localStorage metadata in `isConnected()`, also call `clearTokenInSW()` to ensure the SW drops any corresponding stale token. (5) Do NOT add 401 to the retry set in resilientFetch -- retrying with an expired token is both wasteful and could trip rate limits.

## systemic-aria-semantics.md
- **Verdict**: APPROVE
- **Reasoning**: Systemic accessibility gap analysis proposing ARIA roles, labels, and semantic improvements across all interactive components. Entirely UI/a11y focused with no auth or data flow modifications. No security concerns.
- **Conditions**: None.

## systemic-responsive-design.md
- **Verdict**: APPROVE
- **Reasoning**: Systemic responsive design proposal introducing breakpoint strategy, responsive primitives, and a `useMediaQuery` hook. Purely layout and CSS-level changes. The `CollapsiblePanel` component manages visibility state only. No auth, token, or API surface changes.
- **Conditions**: None.

---

## Summary

| Proposal | Verdict |
|---|---|
| enhance-error-recovery-ux | APPROVE* |
| enhance-keyboard-navigation-and-accessibility | APPROVE |
| enhance-progressive-auth-nudges | APPROVE* |
| enhance-responsive-layout-and-performance | APPROVE* |
| enhance-responsive-layout | APPROVE |
| enhance-structured-error-recovery-and-auth-resilience | APPROVE* |
| fix-a11y-fundamentals | APPROVE |
| fix-abort-signal-providers | APPROVE |
| fix-auth-wiring | APPROVE* |
| fix-board-default-id | APPROVE |
| fix-card-focus-indicator | APPROVE |
| fix-chat-textarea-label | APPROVE |
| fix-double-text-filter | APPROVE |
| fix-escape-stop-streaming | APPROVE |
| fix-priority-indicator | APPROVE |
| fix-provider-switch | APPROVE* |
| fix-responsive-layout | APPROVE |
| fix-sidebar-board-navigation | APPROVE |
| fix-skip-nav-headings | APPROVE |
| fix-theme-state-consolidation | APPROVE |
| fix-token-expiry-handling | APPROVE* |
| systemic-aria-semantics | APPROVE |
| systemic-responsive-design | APPROVE |

**No vetoes issued.** 23 proposals reviewed: 15 unconditional approvals, 8 conditional approvals (marked *). Zero rejects.

The conditional approvals center on three security themes:
1. **OAuth callback route safety** (enhance-progressive-auth-nudges, fix-auth-wiring): CSRF state validation, code cleanup from URLs, open redirect prevention
2. **Token expiry handling** (fix-token-expiry-handling, enhance-structured-error-recovery-and-auth-resilience): Consistent token cleanup across SW and main thread, no stale token injection
3. **Error message sanitization** (enhance-error-recovery-ux, enhance-structured-error-recovery-and-auth-resilience): Never render raw API responses, headers, or token metadata to the DOM
