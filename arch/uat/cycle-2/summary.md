# UAT Cycle 2 Summary

## Test Baseline
- JS tests: 305 passed (305 total) — no change
- Rust tests: 37 passed (37 total) — no change
- TS errors: 3 pre-existing → 3 pre-existing (fixed 1: `this.endpoint` → `this.relayUrl`)

## Findings
- **Critical issues**: 17+ across 5 personas
- **UX issues**: 25+ across 5 personas
- **Polish items**: 25+ across 5 personas

## Key Finding Categories
| Category | Count | Reports |
|----------|-------|---------|
| Auth buttons non-functional | 6 | UAT-1, UAT-4 |
| Navigation broken (default boardId) | 3 | UAT-1, UAT-2 |
| Keyboard workflows broken | 5 | UAT-2, UAT-4 |
| Accessibility gaps (WCAG A) | 9 | UAT-3 |
| Responsive layout missing | 5 | UAT-5 |
| Error recovery poor | 6 | UAT-4 |

## Proposals
- **Fixes**: 13 proposals (9 Effort S, 4 Effort M)
- **Enhancements**: 5 proposals (3 Effort M, 2 Effort L)
- **Systemic**: 4 proposals (1 Effort S, 1 Effort M, 2 Effort L)

## Voted
- **14 approved**, 0 rejected, 0 vetoed
- 9 S-effort fixes selected for immediate implementation

## Implemented (this cycle)
1. **fix-sidebar-board-navigation** — Changed `boardId: 'default'` to `'1'` in sidebar, landing page, command palette
2. **fix-escape-stop-streaming** — Added `aegis:stop-streaming` event listener in ChatView
3. **fix-provider-switch** — Use `switchProvider` when session already exists instead of no-op `createSession`
4. **fix-card-focus-indicator** — Added `isFocused` prop with ring highlight and `aria-selected` to board cards
5. **fix-chat-textarea-label** — Added `aria-label="Type a message"` to chat textarea
6. **fix-priority-indicator** — Added text label alongside color dot for WCAG 1.4.1 compliance
7. **fix-abort-signal-providers** — Added `signal: params.signal` to Vertex AI, Ollama, and Custom provider `fetch()` calls; fixed `this.endpoint` → `this.relayUrl`
8. **fix-skip-nav-headings** — Added skip navigation link, `id="main-content"` on main element, `document.title` updates on all routes
9. **fix-theme-state-consolidation** — Created shared `useThemeStore` Zustand store, replaced 3 independent theme implementations

## Files Changed
- 17 modified files
- 1 new file (`src/stores/theme.ts`)

## Remaining (deferred to cycle 3+)
- Auth wiring (L effort) — connecting OAuth initiation functions to UI buttons + callback route
- Token expiry handling (M effort) — SW expiry checks + refresh token implementation
- Error recovery UX (M effort) — structured error display, retry buttons, cache invalidation
- Systemic ARIA semantics (M effort) — comprehensive widget ARIA attributes
- Responsive layout (L effort) — collapsible sidebar, adaptive panels
- Progressive auth nudges (L effort) — onboarding wizard activation

## Trend
- First UAT cycle completed — baseline established
- Auth wiring is the single largest remaining blocker (6 critical findings)
- Accessibility is the widest systemic gap (29 findings from UAT-3 alone)
- 9 quick wins shipped, reducing UX friction across keyboard, accessibility, and state consistency
