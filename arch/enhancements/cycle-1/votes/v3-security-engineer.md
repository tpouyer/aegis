# Votes: Security Engineer

## growth-contextual-empty-states.md
- **Verdict**: APPROVE
- **Reasoning**: Purely presentational components with no new data fetching, no auth changes, and no user input processing beyond button clicks. No new attack surface is introduced. The components render static copy and link to existing routes.
- **Conditions**: Ensure CTA buttons use router navigation (no raw `window.location` assignments). Any user-facing text must be static strings, not interpolated from external data, to avoid DOM injection.

## growth-interactive-playground.md
- **Verdict**: APPROVE
- **Reasoning**: The playground uses static JSON fixtures bundled at build time with no network calls and no auth. Components receive injected data via props, bypassing TanStack Query hooks. The input is disabled in chat and commits are disabled in IDE, which correctly prevents unauthorized mutations. No tokens, no API keys, no auth state is involved.
- **Conditions**: The `staticData` / `demoMessages` / `staticFiles` props must not be settable from URL parameters or user input -- they must only come from the bundled fixture module. Monaco editor in playground mode must not allow arbitrary code execution or network requests.

## growth-keyboard-shortcuts-command-palette.md
- **Verdict**: APPROVE
- **Reasoning**: This is a combined keyboard shortcuts and command palette proposal. It registers keydown listeners and dispatches to existing store actions or router navigations. No new data flows, no auth changes, no external API calls. The command registry stores static metadata (label, icon, shortcut, action callback). Fuzzy search operates on locally cached data only.
- **Conditions**: The command registry must not allow dynamic registration of commands from untrusted sources (e.g., URL parameters, postMessage). Single-key shortcuts (j/k/h/l) must be suppressed when focus is in any input, textarea, or contenteditable element to prevent unintended action dispatch during typing.

## growth-progressive-auth-nudges.md
- **Verdict**: APPROVE with conditions
- **Reasoning**: The inline auth prompts replace modal dialogs but maintain the same auth flow (PKCE OAuth via AuthManager). The auth redirect preservation using sessionStorage is a standard, safe pattern. The Ollama localhost detection (`fetch('http://localhost:11434/api/tags')`) is a minor concern -- it probes a local service, which could be considered a port-scanning side channel, but the impact is negligible since it only checks a well-known Ollama port and fails silently.
- **Conditions**: (1) The Ollama detection fetch must use `mode: 'no-cors'` or a simple HEAD request and must not expose response data to the page beyond a boolean "available" flag. Do not parse or display the model list from localhost in a way that could leak local environment details to other origins. (2) API key inputs in `InlineProviderSetup` must never store keys in localStorage or any page-accessible storage -- keys must be sent directly to the Service Worker via postMessage (SET_TOKEN) and held only in SW memory. (3) The `sessionStorage` key for auth redirect (`aegis_auth_return`) must be validated on consumption to ensure it is a same-origin relative path, preventing open redirect attacks.

## growth-shareable-deep-links.md
- **Verdict**: APPROVE with conditions
- **Reasoning**: Deep links encode view state (filters, file paths, line numbers, message anchors) in URL parameters and hash fragments. This is standard web practice and does not expose sensitive data. Board filters are derived from user interaction, not tokens. The auth-gated fallback correctly blocks content for unauthenticated users and redirects to OAuth.
- **Conditions**: (1) URL search parameters read from `router.navigate({ search })` must be sanitized before being used in any DOM rendering or query construction. Filter values like `assignee`, `component`, and `text` must be treated as untrusted input. (2) The `file` parameter in IDE deep links must be validated against the VFS tree to prevent path traversal (e.g., `../../.env`). (3) The `aegis_auth_return` sessionStorage value must be validated as a relative same-origin path on consumption to prevent open redirects (same condition as the progressive auth nudges proposal). (4) Chat message anchors (`#msg-*`) should use `element.scrollIntoView()` with IDs that are deterministic and not user-controlled to avoid DOM clobbering.

## platform-cache-eviction-and-quota.md
- **Verdict**: APPROVE
- **Reasoning**: This proposal improves storage hygiene, which is a security positive. Unbounded IndexedDB growth is itself a risk (denial of service via quota exhaustion, stale sensitive data lingering). The eviction scheduler, quota-aware writes, and per-domain budgets reduce the window during which cached data (issue details, chat history) persists. The settings panel "Clear cache" buttons give users control over their local data, which aligns with data minimization principles.
- **Conditions**: Ensure that the eviction scheduler does not log or surface cached data content in error messages or toasts. The `navigator.storage.estimate()` call is safe and does not expose cross-origin data.

## platform-llm-context-budget.md
- **Verdict**: APPROVE with conditions
- **Reasoning**: The context budget manager operates on chat message data that is already in the page's memory (Zustand store). The token estimation is a local computation with no security implications. The conversation compaction (summarization) requires an additional LLM call, which must go through the existing SW relay to avoid exposing tokens. The system prompt truncation by priority is a good security pattern -- it prevents sensitive org context from being sent unnecessarily to LLM providers.
- **Conditions**: (1) The summarization LLM call (Phase 2 compaction) must use the same `/_aegis/llm/` relay path through the Service Worker, not a direct fetch with tokens in page JS. (2) The `estimatedTokens` field added to `ChatMessage` must not be used to infer or reconstruct token values -- it is purely a numeric count. (3) Truncated org context sections should not include partial secrets or credentials if org context documents happen to contain them -- truncation boundaries should be at section level, not mid-line.

## platform-offline-resilience.md
- **Verdict**: APPROVE with conditions
- **Reasoning**: The mutation queue persists pending mutations (Jira transitions, git commits) in IndexedDB. These mutations contain issue keys, transition IDs, commit payloads, and potentially code diffs. This is sensitive data that persists on disk. The stale-while-revalidate pattern for read paths is safe. The VFS tree persistence in IndexedDB is also acceptable since it contains file paths (not file content). The optimistic UI persistence in IndexedDB is a minor concern since it stores board state snapshots.
- **Conditions**: (1) The mutation queue in IndexedDB must not store auth tokens or API keys in the `payload` field. Mutations should reference provider names, and the SW should inject auth headers at replay time, not at queue time. (2) Queued mutations should have a maximum age (e.g., 24 hours). Stale mutations should be expired and discarded to prevent replaying outdated operations. (3) The "Pending changes" panel must not display raw API payloads that could contain sensitive data -- show only human-readable summaries (e.g., "Transition AAP-1234 to In Progress").

## platform-resilient-api-fetch.md
- **Verdict**: APPROVE
- **Reasoning**: The resilient fetch wrapper adds retry, backoff, and deduplication around native `fetch()`. This does not change the auth model -- tokens are still injected by the Service Worker's fetch interceptor, not by the resilient fetch layer in page JS. The retry logic respects `Retry-After` headers and has a max-retry cap, preventing infinite retry loops. Request deduplication for GETs is safe and reduces unnecessary API calls.
- **Conditions**: Ensure that the resilient fetch layer does not log or expose response bodies in error paths. The `isThrottled` boolean exposed for UI consumption must not leak which specific provider is rate-limited in a way that could inform an attacker about API usage patterns.

## platform-structured-error-recovery.md
- **Verdict**: APPROVE with conditions
- **Reasoning**: The error classification and recovery system improves security posture by properly handling AUTH_EXPIRED (401) errors with automatic re-auth prompts instead of showing raw error messages. The auth-expired interceptor that pauses requests, prompts re-auth, and replays is a well-established pattern (github.dev uses it). The error history panel stores classified errors locally -- this is a minor data retention concern.
- **Conditions**: (1) The error classifier must sanitize error messages before displaying them. Raw API responses (especially from 401/403 errors) can contain internal URLs, server versions, or stack traces that should not be shown to the user. Strip response bodies from error display; show only the classified category and human-readable guidance. (2) The error history panel must not persist across sessions (no localStorage for error logs) to avoid retaining sensitive error details. Keep it in-memory only. (3) The auth-expired interceptor's request replay queue must discard queued requests if re-auth fails, and must not retry more than once after re-auth to prevent credential stuffing loops.

## power-command-palette.md
- **Verdict**: APPROVE
- **Reasoning**: The command palette queries data exclusively from local Zustand stores and IndexedDB cache -- no network calls during search. The recency list stored in localStorage contains only issue keys and command IDs, not sensitive data. Route navigation uses TanStack Router's `useNavigate()`, which is safe. The fuzzy-match utility operates on strings in memory.
- **Conditions**: The file mode (`>` prefix) must only search file trees from repos the user has already authenticated to access. The palette must not surface issue data from content visibility tiers above the user's current auth level -- respect the WASM engine's content filtering.

## power-ide-file-search.md
- **Verdict**: APPROVE
- **Reasoning**: The file finder operates on the VFS tree already loaded in memory. No new API calls. Monaco's built-in `quickOutline` and `gotoLine` commands are triggered via the editor instance API, which is a safe pattern. The fuzzy match scoring function is a pure computation with no side effects.
- **Conditions**: The file finder must only display files from the current authenticated VFS tree. It must not allow searching across repos the user has not initialized (which would bypass GitHub auth requirements). The `recentFiles` list in localStorage should store only file paths, not file contents.

## power-keyboard-shortcuts.md
- **Verdict**: APPROVE
- **Reasoning**: This is a keyboard shortcuts-only proposal (overlaps with the combined growth proposal). It adds keydown listeners that dispatch to existing store actions. No new data flows, no auth changes. The guard that suppresses single-key shortcuts in input/textarea/contenteditable elements is essential and correctly specified. The `?` help overlay is static content.
- **Conditions**: The `useShortcuts` hook must not register listeners on the `document` level in a way that could be hijacked by injected scripts. Use `{ capture: true }` sparingly and ensure listeners are properly cleaned up on unmount to prevent memory leaks that could be exploited for event interception.

## power-quick-issue-actions.md
- **Verdict**: APPROVE with conditions
- **Reasoning**: The context menu and batch actions trigger Jira API mutations (assign, set priority, transition) through the existing JiraClient, which routes through the Service Worker for auth header injection. The multi-select model stores only issue keys in a `Set<string>`. No new auth flows are introduced. The batch mutation pattern (sequential calls with delay) is preferable to a parallel blast that could trigger rate limiting.
- **Conditions**: (1) The "Assign to me" action must use the current user's accountId from the authenticated session, not from any URL parameter or local input, to prevent impersonation. (2) Batch operations must enforce the same permission checks as individual operations -- if a user lacks write access to a Jira project, the batch action must fail gracefully for those issues. (3) The context menu must not render for users at Guest auth level who lack Jira write permissions, to avoid confusing affordances that would fail on execution.

## power-recent-activity-and-quick-switch.md
- **Verdict**: APPROVE
- **Reasoning**: The recent activity feed stores issue keys, summaries, last view type, and timestamps in localStorage. This is non-sensitive metadata. The status indicator dots derive from existing in-memory store state (chat sessions, VFS dirty tabs) with no new API calls. The quick-switch overlay is a UI-only feature. Route tracking via `useEffect` on mount is a standard React pattern.
- **Conditions**: The `recentIssues` array in localStorage must not store issue content beyond the key and truncated summary (max ~100 chars). It must respect content visibility tiers -- if a user's auth level drops (e.g., token expires), recent items from higher tiers should not remain visible in the sidebar. Clear the recent list on logout.
