# V5: QA Lead Ballot -- Cycle 2

## Summary

23 proposals reviewed. Evaluation criteria: testability of acceptance criteria, regression risk surface area, edge case coverage, overlap/conflict between proposals, and feasibility of test automation. I have flagged significant overlap between several proposals addressing the same UAT findings -- implementing conflicting proposals will cause merge conflicts and wasted effort.

---

## fix-abort-signal-providers.md
- **Verdict**: APPROVE
- **Reasoning**: Extremely well-scoped fix with a single, verifiable behavior change per file. Adding `signal: params.signal` to three fetch calls is low-risk and directly testable via the Network tab. The bonus fix for the `this.endpoint` vs `this.relayUrl` typo in custom.ts is a freebie. No regression risk -- adding an abort signal to fetch cannot break existing behavior.
- **Conditions**: Each provider must have a test verifying that the AbortSignal is passed through. Verify that aborting mid-stream does not leave the chat store in an inconsistent state (e.g., `isStreaming` stuck at true).

## fix-escape-stop-streaming.md
- **Verdict**: APPROVE
- **Reasoning**: Minimal, surgical fix. One `useEffect` with an event listener -- no side effects beyond intended behavior. The test plan is clear and directly verifiable. The acceptance criteria are binary: either Escape stops streaming or it does not. Zero regression risk since this wires up an event that currently has no listener.
- **Conditions**: Must also verify that Escape does not interfere with other Escape handlers (e.g., closing modals, dismissing the command palette) when the chat is not actively streaming.

## fix-double-text-filter.md
- **Verdict**: APPROVE
- **Reasoning**: Clean, single-file fix removing redundant client-side filtering. The bug is well-characterized: server-side JQL returns broader matches that client-side filtering then incorrectly discards. Removing the duplicate filter is the correct approach. Test plan covers the critical edge case (text in description but not summary). Low regression risk since the JQL filter already handles this.
- **Conditions**: Add a test case for when `filters.text` is empty or undefined to ensure no regression in the no-filter path. Verify that any remaining client-side filters (status, priority, assignee) still function correctly after the text filter removal.

## fix-provider-switch.md
- **Verdict**: APPROVE
- **Reasoning**: Small, well-defined fix with clear before/after behavior. The proposed code is concrete and testable. The root cause analysis is sound -- `createSession()` early-returns when session exists, so `switchProvider()` must be called instead. Edge cases to verify: switching to a provider with no models, switching during active streaming.
- **Conditions**: Must test switching provider mid-stream (should either block the switch or abort the stream first). Must verify that switching back to the original provider preserves the prior conversation. Must not lose messages on switch.

## fix-chat-textarea-label.md
- **Verdict**: APPROVE
- **Reasoning**: Trivial fix with zero regression risk -- adding `aria-label` attributes to two elements. The test plan is clear (screen reader verification + automated audit). The command palette `aria-activedescendant` addition is a nice bonus that improves keyboard navigation correctness.
- **Conditions**: None. Ship it.

## fix-card-focus-indicator.md
- **Verdict**: APPROVE
- **Reasoning**: Well-scoped fix with concrete code examples. The visual focus ring is directly testable via both automated tests (check for `ring-2` class) and manual keyboard testing. The `scrollIntoView` behavior is important for usability and testable. Adding `aria-selected` improves screen reader support. Low regression risk -- purely additive styling.
- **Conditions**: Verify that the focus ring does not conflict with the drag-and-drop `isDragging` ring styling. Verify `scrollIntoView` uses `{ block: 'nearest' }` to avoid jarring scroll jumps. Test with 100+ cards to ensure performance is acceptable when navigating with j/k.

## fix-priority-indicator.md
- **Verdict**: APPROVE
- **Reasoning**: Clear WCAG 1.4.1 fix with a concrete code example. The test plan includes color blindness simulation which is the correct approach. Low regression risk. However, the proposal retains `text-[10px]` which was separately flagged as too small for low-vision users -- should use `text-xs` (12px) instead.
- **Conditions**: Use `text-xs` instead of `text-[10px]` per accessibility findings. Test with long priority names (e.g., custom Jira priorities like "Showstopper") to ensure the card layout handles overflow gracefully (truncation or wrapping).

## fix-board-default-id.md
- **Verdict**: APPROVE
- **Reasoning**: The root cause is well-identified (`Number('default')` producing `NaN`) and the solution is sound -- handle `'default'` as a valid string that triggers an auth-required empty state. The "board selector" stretch goal is reasonable. Test plan covers the critical paths. This overlaps with fix-sidebar-board-navigation but takes the better approach (making `'default'` valid rather than hardcoding `'1'`).
- **Conditions**: This proposal MUST be chosen over fix-sidebar-board-navigation -- they address the same bug with conflicting solutions. This one is architecturally superior because it handles the case where a user has Jira connected but no specific board configured. Must handle the edge case where `boardId` is a non-numeric, non-'default' string (e.g., `/board/foo`).

## fix-sidebar-board-navigation.md
- **Verdict**: REJECT
- **Reasoning**: This proposes hardcoding `boardId: '1'` everywhere, which is a band-aid fix. It assumes board ID 1 always exists, which may not be true for all Jira instances. fix-board-default-id.md solves the same problem more robustly by making `'default'` a valid sentinel that triggers proper board selection logic. Implementing both would create conflicts. From a testability standpoint, this fix is also harder to validate -- how do you test that board `1` always exists?
- **Conditions**: N/A

## fix-skip-nav-headings.md
- **Verdict**: APPROVE
- **Reasoning**: Well-scoped a11y fix covering skip navigation, page titles, and heading hierarchy -- three distinct WCAG violations. Code examples are concrete. Low regression risk since these are additive DOM changes (adding elements, not modifying existing ones). Overlaps with fix-a11y-fundamentals but is narrower in scope and more likely to be implemented correctly without regressions. However, fix-a11y-fundamentals is more comprehensive.
- **Conditions**: If fix-a11y-fundamentals is also approved, this proposal should be SKIPPED to avoid duplication. The two are not compatible as simultaneous work items. If this one proceeds, must verify that `sr-only` skip link becomes visible on focus (`focus:not-sr-only`).

## fix-a11y-fundamentals.md
- **Verdict**: APPROVE
- **Reasoning**: Comprehensive Level A WCAG fix covering 7 items. Well-structured with specific file paths, line numbers, and concrete code changes. Test plan includes automated (axe-core), manual keyboard, and screen reader testing -- the right combination. Effort is marked S which is realistic for the scope. This subsumes fix-skip-nav-headings, fix-chat-textarea-label, and fix-priority-indicator. From a QA perspective, I prefer this consolidated approach because it lets us run a single axe-core audit to validate all fixes at once rather than piecemeal.
- **Conditions**: Must NOT be implemented simultaneously with fix-skip-nav-headings, fix-chat-textarea-label, or fix-priority-indicator -- those are subsets of this proposal. If those smaller fixes are also approved, coordinate implementation order to avoid merge conflicts. Priority icons must be tested with all Jira priority levels (Highest, High, Medium, Low, Lowest, and any custom priorities).

## fix-auth-wiring.md
- **Verdict**: APPROVE
- **Reasoning**: This is the highest-priority fix in the entire cycle. Authentication is completely non-functional -- all OAuth buttons are stubs. The proposal is thorough: it covers landing page, settings page, callback route, and Jira client initialization. The test plan includes both unit and integration tests plus manual OAuth flow verification. Creating a new route file (`auth.callback.tsx`) is the correct approach.
- **Conditions**: Must handle OAuth error states (user denies permission, invalid state parameter, expired authorization code). Must handle the case where the callback route is hit directly without a prior OAuth initiation (stale bookmark, manual URL entry). Must store the pre-auth redirect destination in sessionStorage and verify it is cleaned up after use. Security review required for PKCE implementation and state parameter validation.

## fix-token-expiry-handling.md
- **Verdict**: APPROVE
- **Reasoning**: Critical fix addressing the silent failure mode when tokens expire. The phased approach (detect-and-surface now, refresh later) is pragmatic and testable. The five-point solution is well-structured with clear boundaries. Particularly important: the SW token expiry check prevents the useless 401 round-trip entirely. Test plan covers both unit tests and the critical manual test of natural token expiry.
- **Conditions**: Must coordinate with fix-auth-wiring -- token expiry detection is only useful if re-auth actually works. These two should be implemented in sequence (auth-wiring first, then token-expiry). The `expiresAt` check must account for clock skew (add a 60-second buffer). Must handle the case where `expiresAt` is undefined or missing from token metadata (treat as expired, not as valid forever).

## fix-theme-state-consolidation.md
- **Verdict**: APPROVE
- **Reasoning**: Clean architectural fix consolidating three independent theme implementations into one Zustand store. The proposed code is complete and correct. Low regression risk since theme toggling is cosmetic. Test plan covers cross-component synchronization and persistence. This also fixes the command palette DOM manipulation issue.
- **Conditions**: Must verify that the initial state correctly reads from both `localStorage` AND the current DOM class (for the case where localStorage is cleared but the class was set by a previous session). Must test with localStorage disabled/full to ensure graceful degradation.

## fix-responsive-layout.md
- **Verdict**: APPROVE
- **Reasoning**: Well-structured responsive fix covering all five layout areas (sidebar, root, IDE, chat, filter bar). Creating a Zustand store for sidebar state is the correct approach and also fixes the brittle DOM manipulation issue. Test plan covers four viewport sizes. Effort M is realistic. This overlaps with enhance-responsive-layout and the responsive portion of enhance-responsive-layout-and-performance.
- **Conditions**: Must be chosen as the responsive fix if approved -- do NOT also implement enhance-responsive-layout (simpler, less complete) or the responsive sections of enhance-responsive-layout-and-performance (bundled with too many other concerns). Test at intermediate breakpoints (e.g., 900px, 1100px) not just the four standard sizes, to catch edge cases in the transition zones.

## enhance-error-recovery-ux.md
- **Verdict**: APPROVE
- **Reasoning**: Addresses four distinct error handling gaps with clear, testable acceptance criteria for each. The chat error banner (item 1) and retry mechanism (item 2) are straightforward UI additions. The ErrorBoundary query cache invalidation (item 3) directly fixes the infinite retry loop. Auth expiry detection (item 4) overlaps with fix-token-expiry-handling but approaches it from the UI side. Effort M is accurate.
- **Conditions**: Item 4 (auth expiry detection) must coordinate with fix-token-expiry-handling to avoid conflicting implementations. If both are approved, the token-expiry fix should own the detection logic and this proposal should own the UI presentation. Must test the ErrorBoundary cache invalidation with TanStack Query's `staleTime` and `gcTime` settings to ensure the cache is actually cleared, not just marked stale.

## enhance-progressive-auth-nudges.md
- **Verdict**: REJECT
- **Reasoning**: This proposal significantly overlaps with fix-auth-wiring.md. Both propose wiring OAuth buttons and creating a callback route. The auth-wiring fix is more detailed and better scoped. The "progressive nudges" (item 4) are vaguely specified with no concrete acceptance criteria -- "show a contextual nudge" is not testable without mockups or specific component designs. The OnboardingWizard rendering (item 1) is the only unique value, but it adds risk by introducing a modal on first visit that may confuse users or interfere with other flows.
- **Conditions**: N/A. If the OnboardingWizard is desired, it should be a separate, smaller proposal with clear acceptance criteria for each wizard step.

## enhance-keyboard-navigation-and-accessibility.md
- **Verdict**: ABSTAIN
- **Reasoning**: This is an excellent, comprehensive proposal that addresses 21 UAT findings with detailed solutions. However, it is marked as Effort L and touches 16+ files across every major component. From a QA perspective, the regression risk surface area is enormous -- modifying Card.tsx, BoardView.tsx, Column.tsx, MessageList.tsx, FileExplorer.tsx, and EditorTabs.tsx simultaneously creates compounding risk. More critically, this proposal subsumes at least 5 other standalone proposals (fix-a11y-fundamentals, fix-skip-nav-headings, fix-card-focus-indicator, fix-chat-textarea-label, fix-priority-indicator) and the ARIA portions of systemic-aria-semantics. If those smaller proposals pass, this becomes redundant in many areas. If this passes instead, the smaller ones become redundant. The coordination problem is significant.
- **Conditions**: If approved, ALL overlapping smaller proposals (fix-a11y-fundamentals, fix-skip-nav-headings, fix-card-focus-indicator, fix-chat-textarea-label, fix-priority-indicator) must be WITHDRAWN to avoid merge conflicts. Must be implemented incrementally (not as one giant PR) with intermediate test checkpoints. Needs a dedicated QA pass per section (8 sections = 8 test rounds).

## enhance-responsive-layout.md
- **Verdict**: REJECT
- **Reasoning**: This is a less detailed version of fix-responsive-layout.md. It covers the same four areas (sidebar, board columns, chat panel, IDE panels) but with less specificity. The board column stacking (vertical on mobile) is a unique idea but could cause usability issues -- kanban boards are inherently horizontal, and stacking columns vertically makes it impossible to see card distribution across statuses. fix-responsive-layout.md is the better proposal for responsive work.
- **Conditions**: N/A

## enhance-responsive-layout-and-performance.md
- **Verdict**: ABSTAIN
- **Reasoning**: This is a kitchen-sink proposal bundling 8 distinct workstreams: responsive sidebar, responsive IDE, responsive chat, code splitting, board virtualization, chat streaming optimization, cache eviction, and touch target fixes. While each individual item is valuable, the combined scope (20+ files, Effort L) represents the highest regression risk of any proposal in this cycle. Introducing `@tanstack/react-virtual`, Zustand `immer` middleware, lazy route loading, and responsive breakpoints simultaneously is a QA nightmare -- any one of these could introduce subtle rendering bugs. The performance optimizations (virtualization, mutable streaming, cache eviction) need isolated benchmarks before and after, which is infeasible if bundled with layout changes.
- **Conditions**: If approved, must be split into at least 3 independent PRs: (1) responsive layout changes, (2) virtualization and performance, (3) code splitting and caching. Each PR must pass the full test suite independently before the next is started. Performance claims (200ms render, 60fps scroll) must be validated with automated benchmarks, not just manual eyeballing.

## enhance-structured-error-recovery-and-auth-resilience.md
- **Verdict**: APPROVE
- **Reasoning**: This is the most thorough error-handling proposal in the cycle. The 7-point solution creates a proper error classification layer, fixes the SW token injection bug, upgrades ErrorBoundary with cache invalidation, and fixes the SPA navigation issue. Unlike enhance-error-recovery-ux which is more UI-focused, this proposal builds the underlying infrastructure (error classifier, classified errors, enhanced toasts) that other error-related fixes can build on. Test plan is comprehensive with both unit and integration tests. Effort M is realistic given the well-defined scope.
- **Conditions**: Must coordinate with fix-token-expiry-handling (overlapping SW and AuthManager changes). If both pass, they should be sequenced: this proposal first (it creates the error classification infrastructure), then token-expiry-handling can use the classification types. The `ClassifiedError` type must be exported and documented for use by other components. Must test the toast persistence behavior -- persistent toasts that never auto-dismiss could accumulate and obscure the UI if the user ignores them (add a max count or stacking behavior).

## systemic-aria-semantics.md
- **Verdict**: ABSTAIN
- **Reasoning**: The problem statement is accurate -- ARIA semantics are systematically missing. However, the proposal is a checklist, not a concrete implementation plan. "Create an accessibility audit checklist and apply it across all interactive components" is process guidance, not a testable deliverable. The test plan ("run axe-core -- zero violations") is aspirational but does not define which specific violations should be resolved. More importantly, fix-a11y-fundamentals and enhance-keyboard-navigation-and-accessibility both provide concrete, file-level implementations for the same findings. This proposal adds organizational value but is not implementable as a standalone work item.
- **Conditions**: If approved, must be rewritten with specific, per-component code changes (like fix-a11y-fundamentals provides). As currently written, the acceptance criteria are too vague for QA to write test cases against.

## systemic-responsive-design.md
- **Verdict**: REJECT
- **Reasoning**: This proposes creating new abstraction components (`CollapsiblePanel`, `ResponsiveLayout`, `useMediaQuery`) before applying responsive fixes, which is premature abstraction. The concrete responsive proposals (fix-responsive-layout, enhance-responsive-layout-and-performance) achieve the same goals using standard Tailwind breakpoint classes without introducing new components. Creating `CollapsiblePanel` and `ResponsiveLayout` wrappers adds indirection that makes the code harder to test and debug. The test plan is identical to the other responsive proposals but with more implementation risk.
- **Conditions**: N/A

---

## Vote Summary

| Proposal | Type | Verdict |
|----------|------|---------|
| fix-abort-signal-providers | fix | APPROVE |
| fix-escape-stop-streaming | fix | APPROVE |
| fix-double-text-filter | fix | APPROVE |
| fix-provider-switch | fix | APPROVE |
| fix-chat-textarea-label | fix | APPROVE |
| fix-card-focus-indicator | fix | APPROVE |
| fix-priority-indicator | fix | APPROVE |
| fix-board-default-id | fix | APPROVE |
| fix-sidebar-board-navigation | fix | REJECT |
| fix-skip-nav-headings | fix | APPROVE |
| fix-a11y-fundamentals | fix | APPROVE |
| fix-auth-wiring | fix | APPROVE |
| fix-token-expiry-handling | fix | APPROVE |
| fix-theme-state-consolidation | fix | APPROVE |
| fix-responsive-layout | fix | APPROVE |
| enhance-error-recovery-ux | enhancement | APPROVE |
| enhance-progressive-auth-nudges | enhancement | REJECT |
| enhance-keyboard-navigation-and-accessibility | enhancement | ABSTAIN |
| enhance-responsive-layout | enhancement | REJECT |
| enhance-responsive-layout-and-performance | enhancement | ABSTAIN |
| enhance-structured-error-recovery-and-auth-resilience | enhancement | APPROVE |
| systemic-aria-semantics | systemic | ABSTAIN |
| systemic-responsive-design | systemic | REJECT |

**Totals**: 15 APPROVE, 4 REJECT, 4 ABSTAIN

## Conflict Matrix -- Proposals That Must Not Ship Together

The following groups address overlapping UAT findings. Only one from each group should proceed to implementation:

1. **Board navigation**: fix-board-default-id (APPROVED) vs fix-sidebar-board-navigation (REJECTED) -- pick fix-board-default-id
2. **Responsive layout**: fix-responsive-layout (APPROVED) vs enhance-responsive-layout (REJECTED) vs responsive sections of enhance-responsive-layout-and-performance (ABSTAIN) vs systemic-responsive-design (REJECTED) -- pick fix-responsive-layout
3. **A11y fundamentals**: fix-a11y-fundamentals (APPROVED) subsumes fix-skip-nav-headings, fix-chat-textarea-label, and fix-priority-indicator. If fix-a11y-fundamentals proceeds, the three smaller fixes should be SKIPPED (they are already covered). If fix-a11y-fundamentals is blocked, the three smaller fixes can proceed independently.
4. **Error recovery**: enhance-structured-error-recovery-and-auth-resilience (APPROVED) vs enhance-error-recovery-ux (APPROVED) -- these are complementary (infrastructure vs UI), but implementation must be sequenced: structured-error-recovery first, then error-recovery-ux builds on it.
5. **Auth**: fix-auth-wiring (APPROVED) vs enhance-progressive-auth-nudges (REJECTED) -- pick fix-auth-wiring. fix-token-expiry-handling depends on fix-auth-wiring and should be sequenced after it.

## Recommended Implementation Order

1. fix-auth-wiring (unblocks all auth-dependent features)
2. fix-token-expiry-handling (depends on #1)
3. enhance-structured-error-recovery-and-auth-resilience (depends on #2 for token handling)
4. fix-a11y-fundamentals (subsumes skip-nav, textarea-label, priority-indicator)
5. fix-theme-state-consolidation (independent, low risk)
6. fix-responsive-layout (independent, medium risk)
7. fix-board-default-id, fix-double-text-filter, fix-provider-switch, fix-escape-stop-streaming, fix-abort-signal-providers, fix-card-focus-indicator (all independent, small, low risk -- can be parallelized)
8. enhance-error-recovery-ux (depends on #3 for error classification types)
