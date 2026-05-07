# Votes: Staff Engineer

## growth-contextual-empty-states.md
- **Verdict**: APPROVE
- **Reasoning**: Empty states are purely additive presentational components that slot into existing view components with conditional rendering. The effort estimate (S) is accurate -- each is 50-100 lines of Shadcn primitives, no new state management, no API work. This is the highest-ROI UX improvement on the table: every dead-end screen is an adoption leak, and plugging them requires near-zero ongoing maintenance.
- **Conditions**: Keep the copy contributor-focused as proposed. Do not introduce a new illustration/icon library -- use Lucide icons already in the dependency tree.

## growth-interactive-playground.md
- **Verdict**: REJECT
- **Reasoning**: The proposal claims M effort but underestimates the maintenance burden. Injecting `staticData`, `demoMessages`, and `staticFiles` props into BoardView, ChatView, and IDELayout creates a second code path through every major component that must be kept in sync as those components evolve. Every future feature change to the board, chat, or IDE must also be validated against playground mode. The static fixture data itself becomes stale and confusing as real features change. This is a marketing feature masquerading as an M-sized engineering task.
- **Conditions**: N/A

## growth-keyboard-shortcuts-command-palette.md
- **Verdict**: REJECT
- **Reasoning**: This proposal is a superset that duplicates two other proposals in this cycle: `power-command-palette.md` and `power-keyboard-shortcuts.md`. It covers the same command palette (Cmd+K), the same global shortcuts, the same board/chat/IDE shortcuts, and the same help overlay. Approving this alongside either of the power-user proposals would mean double-specifying the same work. If we want keyboard shortcuts and a command palette, approve the dedicated proposals, not this bundled growth variant which adds no unique functionality.
- **Conditions**: N/A

## growth-progressive-auth-nudges.md
- **Verdict**: APPROVE
- **Reasoning**: This directly addresses a real gap between the design doc's "progressive auth" contract (section 4.3) and the current implementation, which uses a blocking modal for LLM setup and shows raw errors for auth failures. Replacing modals with inline contextual prompts is architecturally clean -- `InlineAuthPrompt` is a composable presentational component, and `InlineProviderSetup` extends it for the LLM case. The auth redirect preservation pattern (sessionStorage) is standard and long overdue. Effort estimate (M) is realistic.
- **Conditions**: The Ollama localhost detection (`fetch('http://localhost:11434/api/tags')`) will be blocked by browser mixed-content and CORS policies in production (served from HTTPS GitHub Pages). Scope the detection to only fire when the app is served from localhost/127.0.0.1, or drop it from v1 and add it later when the failure modes are well-understood. Do not deprecate OnboardingWizard in this cycle -- just move its trigger point.

## growth-shareable-deep-links.md
- **Verdict**: APPROVE
- **Reasoning**: Board filter persistence in URL params is a one-afternoon change that uses TanStack Router's native search params. Chat message anchors and IDE file+line params are similarly straightforward DOM work. The auth redirect preservation overlaps beneficially with the progressive-auth-nudges proposal. The effort estimate (S) is accurate for parts 1-3. Part 4 (auth-gated fallback) is the only piece with complexity, and it is shared work with the auth nudges proposal.
- **Conditions**: Coordinate the `setPendingRedirect`/`consumePendingRedirect` implementation with the progressive-auth-nudges proposal -- it should be implemented once, not twice. Defer read-only snapshot fallbacks for unauthenticated recipients; that is an M-sized feature buried in an S-sized proposal.

## platform-cache-eviction-and-quota.md
- **Verdict**: APPROVE
- **Reasoning**: The proposal correctly identifies a real gap: `evictExpired()` exists but nothing calls it, `QuotaExceededError` is unhandled at call sites, and Safari's 1GB quota will bite power users. The eviction scheduler and quota-aware writes are foundational infrastructure that every future cache consumer benefits from. The architecture is clean -- a coordinator that manages existing CacheStore instances without changing their interface. Effort estimate (M) is fair given the cross-browser testing required.
- **Conditions**: Start with the eviction scheduler and QuotaExceededError handling only. Defer the per-domain soft budgets and the Settings storage panel to a follow-up -- the soft budgets require empirical data on actual usage patterns that we do not have yet.

## platform-llm-context-budget.md
- **Verdict**: APPROVE
- **Reasoning**: The unbounded `ChatSession.messages` array is a genuine time bomb confirmed by the code -- `appendStreamChunk` and `addMessage` grow without limit, and nothing reads `LLMProvider.maxContextWindow`. The character-based token estimator (1 token ~ 4 chars) is accurate enough for budgeting. The phased compaction strategy (tool pruning first, then summarization, then hard truncation) is well-ordered and each phase is independently valuable.
- **Conditions**: Ship Phase 1 (tool result pruning) and Phase 3 (hard truncation) only. Phase 2 (AI-powered summarization) requires an additional LLM call mid-conversation, which introduces latency, cost, and a recursive failure mode (what if the summarization call itself exceeds context?). Defer Phase 2 to a future cycle. The context usage indicator in the chat UI is nice-to-have, not a blocker.

## platform-offline-resilience.md
- **Verdict**: REJECT
- **Reasoning**: The design doc claims offline capability (section 12, strength 7), but the current codebase has no service worker registration, no stale-while-revalidate in TanStack Query configs, and no mutation queue infrastructure. This proposal is trying to build a full offline-first architecture -- durable IndexedDB-backed mutation queue with FIFO drain, idempotency checks, conflict reconciliation UI, optimistic update persistence, connection monitoring -- on top of an app that has not yet shipped its online-only happy path. The effort estimate (M) is a significant underestimate; a production-quality offline mutation queue with conflict resolution is L-to-XL work. Build the online experience first, then add offline resilience when real users report connectivity issues.
- **Conditions**: N/A

## platform-resilient-api-fetch.md
- **Verdict**: APPROVE
- **Reasoning**: This is the right-sized response to the rate limit risks called out in design doc sections 13.1 and 13.3. A single ~150-line utility module that wraps fetch with retry, backoff, jitter, and Retry-After header awareness is straightforward, well-scoped, and immediately useful. The request deduplication for GET calls is a nice touch that prevents the board+detail-panel double-fetch pattern. The effort estimate (S) is accurate -- two integration points (JiraClient, GitHubClient) and one new file.
- **Conditions**: For the GitHub client, check whether Octokit's existing retry/throttle plugins (`@octokit/plugin-retry`, `@octokit/plugin-throttling`) already cover this. If so, configure them rather than wrapping Octokit in another retry layer, which would cause double-retry behavior.

## platform-structured-error-recovery.md
- **Verdict**: APPROVE
- **Reasoning**: The current error handling is demonstrably inadequate -- the ErrorBoundary shows raw `Error.message`, toasts auto-dismiss after 5 seconds (too fast for complex errors), and 401s are indistinguishable from 500s. The error classification enum and error-to-action mapping are clean abstractions that improve every API consumer. The auth-expired interceptor that pauses requests, prompts re-auth, and replays is exactly what the app needs given the 4-provider auth model. Effort estimate (M) is realistic.
- **Conditions**: The error history panel (bell icon with last 20 errors) is over-engineering for v1. Ship the error classifier, actionable toasts with persistent mode, and the auth-expired interceptor. Defer the error history dropdown -- if toasts are actionable and persistent where needed, a scrollback log adds complexity without proportional value.

## power-command-palette.md
- **Verdict**: APPROVE
- **Reasoning**: A command palette is table-stakes for developer tools and the cleanest way to expose navigation, issue search, file search, and actions through a single entry point. The proposal is well-scoped: one new component (Radix Dialog), one lightweight store, fuzzy matching from existing cached data, and route navigation via TanStack Router. The three-mode design (issue search, file search with `>`, command mode with `/`) is the right abstraction. Effort estimate (M) is accurate.
- **Conditions**: The Monaco Cmd+K collision is real. The proposed mitigation (disable global listener when Monaco has focus) is correct but must be tested carefully -- Monaco's `addCommand` API should be used to register Aegis-specific shortcuts within the editor context rather than fighting the DOM event system.

## power-ide-file-search.md
- **Verdict**: APPROVE
- **Reasoning**: File navigation is the most frequent action in any IDE, and the current FileExplorer requires manual folder-by-folder expansion. The proposal correctly identifies that the VFS tree data already exists in memory, so this is pure UI work with no new API calls. The fuzzy matching can be shared with the command palette. Go-To-Symbol and Go-To-Line are one-line Monaco triggers. Effort estimate (S) is accurate.
- **Conditions**: Implement FileFinder as a mode within the CommandPalette rather than a separate component. The `>` prefix file mode described in `power-command-palette.md` is the same feature. One component, one fuzzy matcher, one set of tests.

## power-keyboard-shortcuts.md
- **Verdict**: APPROVE
- **Reasoning**: The shortcut system (central registry, scoped `useShortcuts` hook, input-element guard) is architecturally clean and aligns with how the existing route structure maps to views. The proposal correctly identifies the Cmd+W browser collision risk and provides a sensible mitigation. Adding `focusedCardIndex` to the board store for j/k navigation is a minimal, well-contained change. Effort estimate (S) is realistic for ~25 shortcuts.
- **Conditions**: Coordinate with `power-command-palette.md` -- the command palette should register its shortcuts through this same registry, not through a separate `keydown` listener. The fuzzy matcher and shortcut registry should be shared infrastructure. Do not intercept `Cmd+W` at all in the first version -- the risk of trapping users is higher than the benefit of closing a tab.

## power-quick-issue-actions.md
- **Verdict**: APPROVE
- **Reasoning**: Part 1 (context menu) is well-scoped and high-value: right-click to assign, set priority, or transition eliminates the open-card-change-field-close-card dance that dominates triage workflows. Radix ContextMenu is already available through Shadcn. The Jira mutation methods (`assignIssue`, `setPriority`, `addLabel`) are thin wrappers around the existing `JiraClient.updateIssue()`. Effort estimate for Part 1 alone is S.
- **Conditions**: Ship Part 1 (context menu) only. Part 2 (multi-select and batch actions) is a separate feature with its own selection model, floating bar UI, batch API orchestration, and rate-limit concerns -- it should be its own proposal in a future cycle. Part 3 (hover icons) is fine to include since it is CSS-only. Do not attempt batch API calls until `platform-resilient-api-fetch` is in place.

## power-recent-activity-and-quick-switch.md
- **Verdict**: APPROVE
- **Reasoning**: The recent issues sidebar section is low-effort, high-value: a lightweight Zustand store persisted to localStorage, a route navigation subscription, and a compact list in the existing Sidebar component. The data model is minimal (issueKey, summary, lastView, timestamp). The status indicator dots derived from existing store state add useful context without new API calls. Effort estimate (S) is accurate.
- **Conditions**: Drop the Ctrl+Tab quick-switch panel from v1. The keydown/keyup interaction pattern (hold Ctrl, press Tab repeatedly, release to navigate) is notoriously difficult to implement correctly across browsers and OS-level keyboard interceptors. Ctrl+Tab is captured by the browser for tab switching in most configurations and cannot be reliably overridden. The sidebar recent list and command palette recency ranking together cover the quick-switch use case adequately.
