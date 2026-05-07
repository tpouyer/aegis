# V1: Staff Engineer Ballot -- Cycle 2

## Evaluation Criteria
- Technical feasibility and correctness of proposed changes
- Implementation complexity vs. user/developer value
- Long-term maintainability and architectural alignment
- Overlap/conflict detection across proposals
- Critical fixes (type: fix, source: C*) held to a lower bar (2/5 threshold)

---

## FIXES

---

## fix-abort-signal-providers.md
- **Verdict**: APPROVE
- **Reasoning**: This is a trivial, surgical fix -- adding `signal: params.signal` to three fetch calls. The problem is real: uncancellable HTTP connections waste API quota and resources. The `this.endpoint` vs `this.relayUrl` typo fix in custom.ts is a bonus. Zero risk, zero maintenance burden.
- **Conditions**: Verify each provider's fetch call site accepts the signal parameter correctly. Add a unit test for at least one provider confirming AbortSignal causes fetch rejection.

## fix-auth-wiring.md
- **Verdict**: APPROVE
- **Reasoning**: This is the single most critical fix in the entire cycle. I verified that Settings `handleConnect` is literally a `console.info` stub -- no user can authenticate at all. The proposal is well-scoped: wire existing functions to existing buttons, create a standard callback route. The OAuth functions already exist and are tested; this is plumbing, not new logic. Without this, the entire app is non-functional for any authenticated feature.
- **Conditions**: The callback route must handle errors gracefully (show error state, not white screen). Store the pre-auth URL in sessionStorage before redirect so the user returns to where they were. Ensure the routeTree regeneration is tested.

## fix-board-default-id.md
- **Verdict**: APPROVE
- **Reasoning**: Verified the bug: `Number('default')` produces `NaN`, and the route rejects it. The proposed solution of handling `'default'` explicitly and showing an auth-required empty state is the right pattern -- it degrades gracefully instead of erroring. Fixing the `g b` shortcut to use `'default'` ensures consistency across all navigation paths.
- **Conditions**: Do not hardcode `boardId: '1'` anywhere -- the `'default'` sentinel approach is better. If Jira is connected, attempt to fetch the user's first board. If not connected, show the auth-required empty state.

## fix-card-focus-indicator.md
- **Verdict**: APPROVE
- **Reasoning**: The j/k keyboard navigation already tracks `focusedCardIndex` in Zustand state but never renders a visual indicator -- making the feature invisible. This is a straightforward prop-passing and CSS fix. The code examples in the proposal are correct and well-structured. Small effort, high impact for keyboard users.
- **Conditions**: Use `scrollIntoView({ block: 'nearest' })` to avoid jarring page jumps. Ensure the focus ring does not conflict with the drag-and-drop shadow styling.

## fix-chat-textarea-label.md
- **Verdict**: APPROVE
- **Reasoning**: Adding `aria-label` to two elements is a one-line fix per file. The WCAG 1.3.1 violation is real and trivially fixable. The `aria-activedescendant` addition to CommandPalette is also correct and valuable for screen reader users navigating the command list.
- **Conditions**: None -- this is as low-risk as it gets.

## fix-double-text-filter.md
- **Verdict**: APPROVE
- **Reasoning**: I verified the issue: `BoardView.tsx:92-103` applies a client-side substring filter on `key + summary` after the server already filtered via JQL `text ~ "..."` which searches across all fields. The client filter is strictly more restrictive, causing false negatives. Removing the client-side text filter is the correct fix since JQL handles it.
- **Conditions**: If there are filters that are NOT handled by JQL (e.g., if some future filter is client-only), leave the client-side filtering infrastructure in place but just remove the text-specific branch. Add a comment documenting which filters are server-side vs client-side.

## fix-escape-stop-streaming.md
- **Verdict**: APPROVE
- **Reasoning**: I confirmed the event is dispatched (`issue.$issueKey.chat.tsx:161`) but never listened for. The proposed `useEffect` listener in ChatView is the correct pattern -- listen for the custom event, call `abortRef.current?.abort()`. Simple, correct, no side effects.
- **Conditions**: Guard against `abortRef.current` being null (already handled by optional chaining in the proposal). Ensure the Escape key handler in the board route does not interfere when the chat route is active.

## fix-priority-indicator.md
- **Verdict**: APPROVE
- **Reasoning**: WCAG 1.4.1 violation -- color-only information conveyance. The proposed Badge with text label is simple and correct. However, the proposal still uses `text-[10px]` which is flagged elsewhere as too small. Use `text-xs` (12px) instead.
- **Conditions**: Use `text-xs` not `text-[10px]` for the badge text. Add `aria-label="Priority: {name}"` to the badge container. Test that longer priority names (e.g., "Highest", "Lowest") do not break card layout.

## fix-provider-switch.md
- **Verdict**: APPROVE
- **Reasoning**: I verified the bug: `createSession` in `stores/chat.ts:78` has an early return when a session already exists, and `switchProvider` at line 164 exists but is never called from the UI. The proposed fix correctly calls `switchProvider` + `switchModel` when a session already exists. Clean, targeted fix.
- **Conditions**: Ensure `switchProvider` does not clear the message history (preserve conversation). Add a brief toast or visual confirmation when the provider switches so the user knows it worked.

## fix-responsive-layout.md
- **Verdict**: APPROVE
- **Reasoning**: This is the most focused of the three responsive layout proposals. It addresses the critical breakage (sidebar consuming 60% of mobile viewport, IDE unusable under 1024px) with standard Tailwind breakpoints. Creating a `sidebarOpen` Zustand atom to replace the brittle DOM classList toggle is architecturally sound. The scope is well-bounded compared to the enhancement-level alternatives.
- **Conditions**: Coordinate with `fix-theme-state-consolidation` -- both propose new Zustand stores. Consider whether `sidebarOpen` belongs in a shared layout store or a separate `ui.ts`. The sidebar overlay on mobile must have a backdrop and close on outside click. Do NOT implement the board column stacking suggested by `enhance-responsive-layout` -- horizontal scroll is fine for board columns on mobile.

## fix-sidebar-board-navigation.md
- **Verdict**: REJECT
- **Reasoning**: This proposal conflicts with `fix-board-default-id.md` and takes the wrong approach. Hardcoding `boardId: '1'` everywhere is fragile -- it assumes a board with ID 1 exists, which is not guaranteed for any Jira instance. The `fix-board-default-id` proposal correctly handles the `'default'` sentinel with graceful fallback. Approving both would create contradictory changes to the same files.
- **Conditions**: N/A -- superseded by `fix-board-default-id.md`.

## fix-skip-nav-headings.md
- **Verdict**: APPROVE
- **Reasoning**: Skip navigation and heading hierarchy are fundamental WCAG Level A requirements. The proposal is well-scoped (small effort, clear changes) and does not overlap dangerously with the larger `fix-a11y-fundamentals` -- it covers a focused subset (skip link, page titles, heading hierarchy). The implementation approach is standard and correct.
- **Conditions**: Use a shared `usePageTitle(title: string)` hook rather than duplicating `useEffect` in each route file. Coordinate with `fix-a11y-fundamentals` to avoid duplicate work on the same files. If both are approved, implementers should merge them into a single PR.

## fix-theme-state-consolidation.md
- **Verdict**: APPROVE
- **Reasoning**: Three independent theme toggles with unsynchronized state is a real UX bug. The proposed Zustand store is the correct solution -- single source of truth, localStorage persistence, used by all three toggle locations. The code example is clean and correct. Small effort, eliminates an entire class of state-sync bugs.
- **Conditions**: Initialize `isDark` from localStorage first, then fall back to `document.documentElement.classList.contains('dark')`, then fall back to `prefers-color-scheme` media query. Coordinate with `fix-responsive-layout` if both create new stores -- consider co-locating in a single `layout.ts` store.

## fix-token-expiry-handling.md
- **Verdict**: APPROVE
- **Reasoning**: Token expiry is a critical gap: the SW injects stale tokens, `isConnected()` returns true from stale metadata, and the user sees raw 401 errors. The phased approach (detect + surface now, refresh later) is pragmatically correct. The SW-side expiry check before injection is particularly valuable -- it prevents the 401 round-trip entirely. The proposal correctly avoids adding 401 to the retry set in resilientFetch.
- **Conditions**: The structured error response from the SW must use a consistent format that the main thread can reliably detect (not just a 401 status). Define the `AuthExpiredError` type in a shared types file. Coordinate with `enhance-structured-error-recovery-and-auth-resilience` -- this proposal is the focused "phase 1" of that larger effort.

## fix-a11y-fundamentals.md
- **Verdict**: APPROVE
- **Reasoning**: This covers seven critical WCAG Level A violations with small effort. There is significant overlap with `fix-skip-nav-headings`, `fix-priority-indicator`, and `fix-chat-textarea-label`, but those are individually smaller and this bundles them into a cohesive accessibility pass. The proposal is technically sound and references the correct files and line numbers.
- **Conditions**: Coordinate with the individual fix proposals to avoid duplicate work. If both this and the individual fixes are approved, the individual fixes should be considered subsumed by this proposal. Priority icons should use distinct shapes (not just text labels) per the proposal's own recommendation. Use `text-xs` not `text-[10px]` for any new badge text.

---

## ENHANCEMENTS

---

## enhance-error-recovery-ux.md
- **Verdict**: APPROVE
- **Reasoning**: The four improvements (chat error display, chat retry, ErrorBoundary cache invalidation, auth expiry detection) are all high-value and address real usability gaps. The proposal is well-scoped at medium effort. The error-as-distinct-UI-element pattern (not inline markdown) is the correct approach. This overlaps with `fix-token-expiry-handling` and `enhance-structured-error-recovery-and-auth-resilience` but is the more pragmatic, less ambitious version.
- **Conditions**: If `enhance-structured-error-recovery-and-auth-resilience` is also approved, this proposal should be subsumed into it (they share 80% of the same work). The chat retry should preserve message history above the failed message. ErrorBoundary `queryClient.invalidateQueries()` should be scoped to relevant queries, not all queries.

## enhance-keyboard-navigation-and-accessibility.md
- **Verdict**: ABSTAIN
- **Reasoning**: This is an excellent, comprehensive proposal that would genuinely transform the app's accessibility posture. However, it is extremely large (L effort, 16+ files, 8 distinct workstreams) and overlaps substantially with `fix-a11y-fundamentals`, `fix-skip-nav-headings`, `fix-card-focus-indicator`, `fix-chat-textarea-label`, `fix-priority-indicator`, and `systemic-aria-semantics`. In a single cycle, attempting all of this alongside the other approved fixes risks spreading implementation too thin. I would prefer to approve the targeted fixes this cycle and revisit this as a cycle-3 epic.
- **Conditions**: If approved, it must be broken into at least 4 separate PRs (skip-nav/structure, board keyboard, chat a11y, IDE file explorer) to be reviewable. Must not block the individual fixes from landing first.

## enhance-progressive-auth-nudges.md
- **Verdict**: APPROVE
- **Reasoning**: The OnboardingWizard is built but never rendered -- this is wasted code that should be activated. The progressive nudge pattern (contextual prompts when hitting auth-gated features) is the right UX approach for a progressive-auth model. The OAuth callback route creation overlaps with `fix-auth-wiring` but adds the onboarding wizard layer.
- **Conditions**: If `fix-auth-wiring` is also approved, coordinate to share the callback route implementation. The onboarding wizard must be dismissible and not block the app. Store `aegis_onboarded` flag only after the user explicitly dismisses or completes the wizard, not on page load.

## enhance-responsive-layout-and-performance.md
- **Verdict**: REJECT
- **Reasoning**: This is a mega-proposal combining 8 distinct workstreams (responsive layout, route code splitting, board virtualization, chat streaming perf, cache eviction, touch targets, theme consolidation, model display names) into one L-effort proposal. While every individual item has merit, bundling them makes the proposal undeliverable in a single cycle and unreviewable as a single PR. Many items overlap with other standalone proposals (`fix-responsive-layout`, `fix-theme-state-consolidation`, `enhance-responsive-layout`). The virtualization and streaming performance items alone are each M-effort projects. This should be decomposed.
- **Conditions**: N/A. The individual concerns are better served by the focused proposals. Virtualization, code splitting, and streaming performance should be separate cycle-3 proposals.

## enhance-responsive-layout.md
- **Verdict**: ABSTAIN
- **Reasoning**: This overlaps almost entirely with `fix-responsive-layout` but is scoped as an enhancement rather than a fix. The fix version covers the same sidebar, IDE, and chat responsiveness. The one unique item here is board column stacking on mobile (vertical vs horizontal), but I am not convinced vertical column stacking is the right UX for a kanban board -- horizontal scroll is the standard pattern. I prefer the fix version.
- **Conditions**: If approved instead of `fix-responsive-layout`, do not implement board column stacking. Keep horizontal scroll for board columns.

## enhance-structured-error-recovery-and-auth-resilience.md
- **Verdict**: APPROVE
- **Reasoning**: This is the most architecturally rigorous error handling proposal. The error classification enum, 401 interceptor in resilientFetch, SW-side expiry check, enhanced toast with action buttons, and ErrorBoundary cache invalidation are all technically correct and well-designed. It subsumes `fix-token-expiry-handling` and `enhance-error-recovery-ux` into a coherent system. The effort is M, which is achievable. The SPA navigation fix (`window.location.href` to `navigate()`) is a valuable bonus.
- **Conditions**: The error classification should be extensible (not a closed enum) to accommodate future error types. The `ClassifiedError` type should extend `Error` so it works with standard catch patterns. The enhanced toast must not create notification fatigue -- rate-limit toasts of the same category. Coordinate with `fix-token-expiry-handling` to avoid duplicate SW changes.

---

## SYSTEMIC

---

## systemic-aria-semantics.md
- **Verdict**: APPROVE
- **Reasoning**: The systemic diagnosis is correct -- components were built for visual correctness without semantic correctness, and the pattern repeats everywhere. The proposed audit checklist approach is sound. However, this overlaps heavily with `fix-a11y-fundamentals` and `enhance-keyboard-navigation-and-accessibility`. I approve this as a framework/checklist that guides the individual fixes, not as a standalone implementation.
- **Conditions**: This should produce an accessibility checklist document and component audit, not a single monolithic PR. The individual fixes (`fix-a11y-fundamentals`, `fix-skip-nav-headings`, etc.) should be the implementation vehicles. If this is implemented as code, break it into per-component PRs.

## systemic-responsive-design.md
- **Verdict**: REJECT
- **Reasoning**: While the diagnosis is accurate, the proposed solution (new `CollapsiblePanel` component, `ResponsiveLayout` wrapper, `useMediaQuery` hook) introduces unnecessary abstraction. The standard approach of using Tailwind breakpoint variants (`hidden md:flex`, `hidden lg:block`) directly on components is simpler, more maintainable, and more idiomatic for a Tailwind project. `fix-responsive-layout` takes this simpler approach. Creating responsive "primitives" and wrapper components adds indirection without proportional value for an app of this size.
- **Conditions**: N/A. The straightforward Tailwind breakpoint approach in `fix-responsive-layout` is preferred.

---

## OVERLAP SUMMARY

Several proposals address the same underlying issues. My recommended resolution:

| Concern | Preferred Proposal | Subsumed By |
|---|---|---|
| Board navigation | fix-board-default-id | fix-sidebar-board-navigation (REJECTED) |
| Responsive layout | fix-responsive-layout | enhance-responsive-layout (ABSTAIN), systemic-responsive-design (REJECTED), enhance-responsive-layout-and-performance (REJECTED) |
| Auth wiring | fix-auth-wiring + enhance-progressive-auth-nudges | Share callback route |
| Token expiry | fix-token-expiry-handling + enhance-structured-error-recovery-and-auth-resilience | Coordinate; structured-error subsumes token-expiry |
| Error recovery | enhance-structured-error-recovery-and-auth-resilience | enhance-error-recovery-ux (coordinate, avoid duplication) |
| A11y fixes | fix-a11y-fundamentals (umbrella) | fix-skip-nav-headings, fix-priority-indicator, fix-chat-textarea-label (subsumed if a11y-fundamentals approved) |
| Theme state | fix-theme-state-consolidation | Part of fix-responsive-layout store work |
| ARIA semantics | systemic-aria-semantics (as checklist) | enhance-keyboard-navigation-and-accessibility (ABSTAIN, defer to cycle 3) |
