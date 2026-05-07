# V2: UX Designer Ballot -- Cycle 2

## enhance-error-recovery-ux.md
- **Verdict**: APPROVE
- **Reasoning**: Errors rendered as inline markdown text in chat messages are a poor UX pattern -- users cannot distinguish errors from content, and there is no clear recovery path. The proposed error banner with a "Retry" button provides an obvious, actionable recovery flow. The ErrorBoundary cache invalidation fix addresses a real infinite-loop trap that destroys user trust.
- **Conditions**: The error banner must be visually distinct (not just a color change) and include an accessible dismissal mechanism. The "Retry" button must receive focus automatically so keyboard users can act on it immediately.

## enhance-keyboard-navigation-and-accessibility.md
- **Verdict**: APPROVE
- **Reasoning**: This is the most comprehensive and well-structured accessibility proposal in the cycle. It directly addresses 7 WCAG Level A violations and numerous Level AA issues with concrete, file-level solutions. The combination of skip navigation, heading hierarchy, card keyboard focus indicators, a context menu as a DnD alternative, ARIA tree semantics for the file explorer, and live regions for chat covers the full spectrum of assistive technology support. The card context menu with "Transition to" submenu is an elegant keyboard alternative to drag-and-drop that also benefits power users.
- **Conditions**: Effort is Large -- recommend splitting into two implementation phases if needed (Pass 1: structural + labels, Pass 2: interactive ARIA + tree navigation). Must verify that `aria-live="polite"` on the message list does not create excessive announcements during rapid streaming -- consider debouncing or using `aria-atomic="false"`. The card context menu should be tested with NVDA and JAWS in addition to VoiceOver to ensure cross-screen-reader compatibility.

## enhance-progressive-auth-nudges.md
- **Verdict**: APPROVE
- **Reasoning**: The OnboardingWizard is fully built but never shown -- this is wasted work and a missed opportunity for guided first-run experience. Wiring auth buttons and creating the callback route are table-stakes for any authentication flow. Progressive nudges at the point of feature use (rather than upfront modal blocking) align with best practices for reducing friction in onboarding.
- **Conditions**: The OnboardingWizard should be dismissible and not block access to public content. The callback route must show a clear loading state during token exchange and handle errors gracefully (not a blank screen). The `aegis_onboarded` flag should reset if the user clears storage, so the wizard reappears rather than leaving users in a broken state.

## enhance-responsive-layout-and-performance.md
- **Verdict**: REJECT
- **Reasoning**: While the individual items are valid, this proposal bundles too many concerns into a single "L" effort: responsive sidebar, responsive IDE, responsive chat, route-level code splitting, board virtualization, chat streaming performance, cache eviction, touch targets, and model display names. From a UX perspective, mixing performance optimization (streaming store allocations, cache eviction, manualChunks) with responsive layout changes makes it harder to test each UX change in isolation and increases the risk of regressions. The responsive layout and performance concerns should be addressed by the more focused proposals already in this cycle.
- **Conditions**: N/A -- prefer the more focused proposals (systemic-responsive-layout, fix-responsive-layout, enhance-responsive-layout) that address the responsive UX concerns without bundling unrelated performance work.

## enhance-responsive-layout.md
- **Verdict**: ABSTAIN
- **Reasoning**: This is a valid but minimal responsive layout proposal that is fully superseded by both `fix-responsive-layout.md` and `systemic-responsive-layout.md`, which cover the same ground with more detail and also address code splitting and state management. Approving this alongside those would create implementation conflicts over the same files (Sidebar, Header, IDELayout, __root.tsx).
- **Conditions**: N/A

## enhance-structured-error-recovery-and-auth-resilience.md
- **Verdict**: APPROVE
- **Reasoning**: The error classification layer is exactly the right architectural approach -- categorizing errors by type (AUTH_EXPIRED, RATE_LIMITED, NETWORK, etc.) enables the UI to show contextually appropriate recovery actions instead of generic error messages. The enhanced toast system with persistent auth-expired toasts and actionable "Re-authenticate" buttons is a significant UX improvement. Fixing `window.location.href` navigation to use client-side routing preserves user state, which matters for any session-dependent workflow. The ErrorBoundary focus management on the retry button is an important accessibility detail.
- **Conditions**: Persistent toasts must have a maximum display count to avoid stacking (e.g., only one AUTH_EXPIRED toast per provider at a time). The error classification should be unit-tested exhaustively. The toast action buttons must be keyboard accessible and have sufficient contrast.

## fix-a11y-fundamentals.md
- **Verdict**: APPROVE
- **Reasoning**: This is a focused, small-effort proposal addressing the most critical WCAG Level A violations: skip navigation, page titles, heading hierarchy, priority indicators, textarea labels, and landmark labels. These are fundamental requirements for screen reader access and keyboard navigation. The proposal is well-scoped with clear file-level changes and a solid test plan including axe-core, VoiceOver, and keyboard-only testing. As a fix type, this addresses compliance-level issues that should not be deferred.
- **Conditions**: The `usePageTitle` hook approach is preferred over individual `useEffect` calls in each route for maintainability. Priority icons should use established patterns (e.g., arrows) rather than custom shapes to ensure universal recognizability. Heading hierarchy should be validated with a heading-level checker to ensure no levels are skipped.

## fix-abort-signal-providers.md
- **Verdict**: APPROVE
- **Reasoning**: When a user clicks "Stop" to halt streaming, they expect it to actually stop. Three of five providers ignoring the AbortSignal means the Stop button is deceptive -- it appears to work (the UI stops rendering) but the HTTP connection continues consuming resources and API quota. This is a small, targeted fix with clear user-facing impact. The `this.endpoint` vs `this.relayUrl` error message fix is a bonus correctness improvement.
- **Conditions**: None -- this is a straightforward one-line-per-file fix with no design risk.

## fix-auth-wiring.md
- **Verdict**: APPROVE
- **Reasoning**: Authentication is completely non-functional -- every "Connect" button in the entire app is a console.info stub. This is the single biggest blocker for any user trying to use board, IDE, or authenticated chat features. The proposal correctly identifies all the pieces that need to be connected (initiation, callback, token storage, JiraClient initialization) and provides a clear implementation plan. From a UX standpoint, this transforms the app from a demo with broken buttons to a functional product.
- **Conditions**: The callback route must handle the error case where the user denies OAuth consent (not just success). Loading states during token exchange should use the existing Loading component for consistency. The callback route should have a timeout so users are not stuck on a spinner if the token exchange hangs.

## fix-board-default-id.md
- **Verdict**: APPROVE
- **Reasoning**: The "Invalid board ID: default" / NaN error is one of the first things any new user encounters when clicking "Board" in the sidebar. It is a confusing, trust-destroying experience. The proposal to handle the `'default'` case gracefully -- showing an auth-required empty state or board picker -- is the right UX pattern. Aligning the `g b` shortcut with the sidebar navigation eliminates an inconsistency that would confuse power users.
- **Conditions**: If the user is authenticated but has no default board configured, a board picker or selector should be shown rather than a dead-end error. The "Board not found" fallback should include a clear call-to-action to navigate to settings.

## fix-card-detail-navigation.md
- **Verdict**: APPROVE
- **Reasoning**: The core user journey (see issue on board -> discuss with AI -> edit code) has missing navigation links. Users should not need to manually type URLs. Adding Chat and IDE links to CardDetail and ensuring the keyboard focus indicator works are both essential for the board-centric workflow. This is a small-effort fix with high user-facing impact.
- **Conditions**: The Chat and IDE action buttons in CardDetail should be visually prominent (not buried in a menu). Use Link components for proper client-side navigation. The focus ring color should be consistent with the app's focus style system.

## fix-card-focus-indicator.md
- **Verdict**: APPROVE
- **Reasoning**: Keyboard navigation that tracks state internally but provides zero visual feedback is worse than having no keyboard navigation at all -- users press j/k, nothing visible happens, and they conclude the feature is broken. The visible focus ring, `tabIndex` management, `aria-selected`, and scroll-into-view are all necessary for keyboard navigation to be usable. This is a critical fix for keyboard-power-users and WCAG 2.4.7 compliance.
- **Conditions**: The focus ring must have sufficient contrast against both light and dark theme backgrounds. The scroll-into-view behavior should use `scrollIntoView({ block: 'nearest' })` to avoid jarring full-scroll jumps.

## fix-chat-textarea-label.md
- **Verdict**: APPROVE
- **Reasoning**: A textarea with no accessible label is a WCAG Level A violation (4.1.2). Screen reader users encounter an unlabeled input and have no idea what it does. The `aria-activedescendant` fix for the command palette is also important for screen reader users to track which command is selected. Both fixes are minimal effort with clear accessibility impact.
- **Conditions**: The aria-label text should be descriptive enough to communicate purpose. "Type a message" is adequate but "Message to AI assistant" (used in another proposal) is slightly more descriptive -- either is acceptable.

## fix-double-text-filter.md
- **Verdict**: APPROVE
- **Reasoning**: Double-filtering causes a frustrating UX where users search for text that appears in issue descriptions, the server returns matches, and the client-side filter silently removes them because it only checks key + summary. Users see empty results for searches they know should match, which erodes trust in the search feature. Removing the redundant client-side filter is a clean, low-risk fix.
- **Conditions**: Verify that removing the client-side text filter does not regress any other filtering behavior. If the server-side JQL filter ever returns stale results (e.g., from cache), the client-side filter was providing an accidental correctness check -- confirm this edge case is handled.

## fix-escape-stop-streaming.md
- **Verdict**: APPROVE
- **Reasoning**: The Escape key is the universal "stop/cancel" gesture across all computing platforms. Users instinctively press Escape to stop streaming, the shortcut is registered, the event fires, but nothing happens because no component listens. This is a small, critical fix that makes a core interaction work as users expect.
- **Conditions**: Ensure the event listener is cleaned up on unmount to prevent memory leaks. Consider whether Escape should only fire when the chat view is focused (not when a modal or overlay is open).

## fix-priority-indicator.md
- **Verdict**: APPROVE
- **Reasoning**: Color-only priority indication fails approximately 8% of male users and violates WCAG 1.4.1. Adding text labels alongside color is the standard remediation. However, the proposed solution uses `text-[10px]` which is the exact too-small font size that other proposals flag as an accessibility issue.
- **Conditions**: Must use `text-xs` (12px) minimum instead of the proposed `text-[10px]`. Test that longer priority names (e.g., "Critical", "Blocker") do not break card layout.

## fix-provider-switch.md
- **Verdict**: APPROVE
- **Reasoning**: Switching LLM providers mid-session is a core power-user workflow. The current behavior where switching silently fails (because `createSession` has an early return for existing sessions) is a confusing UX -- users click a provider, nothing changes, and they have no idea why. The fix to call `switchProvider` when a session exists is straightforward and directly addresses the user expectation.
- **Conditions**: When switching providers, preserve the existing message history. Consider showing a brief toast notification confirming the provider switch so users have feedback that their action worked.

## fix-responsive-layout.md
- **Verdict**: APPROVE
- **Reasoning**: This is a well-scoped, medium-effort responsive layout fix that addresses the most impactful layout breakdowns: sidebar consuming 60% of mobile viewport, IDE panels broken below 1024px, chat context panel overlapping, and FilterBar overflowing. The Zustand-based sidebar state replacing DOM classList manipulation is the right approach. The proposal correctly addresses the same-file overlap issue by replacing the brittle command palette sidebar toggle.
- **Conditions**: The mobile sidebar overlay should include a backdrop/scrim for visual separation. The hamburger button should use a recognizable icon (three horizontal lines). Panel toggle buttons should have tooltips or labels indicating what they show/hide. Test that the sidebar overlay does not trap keyboard focus.

## fix-sidebar-board-navigation.md
- **Verdict**: REJECT
- **Reasoning**: While this identifies the same problem as `fix-board-default-id.md`, the proposed solution of hardcoding `boardId: '1'` everywhere is fragile and incorrect. Board ID 1 may not exist for all Jira instances. The `fix-board-default-id.md` proposal takes the better approach of making `'default'` a valid sentinel value that resolves to the user's actual board. Approving this would conflict with that superior approach.
- **Conditions**: N/A -- prefer `fix-board-default-id.md` which handles this more gracefully.

## fix-skip-nav-headings.md
- **Verdict**: APPROVE
- **Reasoning**: Skip navigation and heading hierarchy are WCAG Level A requirements (2.4.1, 2.4.2, 1.3.1). This proposal is focused and small-effort, covering the exact structural accessibility gaps. The dynamic `document.title` updates are essential for screen reader users who rely on page titles for orientation. Column heading changes from h3 to h2 fix a heading-level skip that breaks screen reader heading navigation.
- **Conditions**: This overlaps significantly with `fix-a11y-fundamentals.md` -- only one should be implemented to avoid file conflicts. If both are approved, they should be merged into a single implementation. The skip link styling on focus should be tested to ensure it is visible and positioned correctly (not hidden behind other elements).

## fix-theme-state-consolidation.md
- **Verdict**: APPROVE
- **Reasoning**: Theme state existing independently in three places (Header, Settings, Command Palette) with different implementations -- including raw DOM manipulation in the command palette -- is a textbook state desynchronization bug. Users toggle dark mode via the command palette, the Header icon does not update, and they lose trust in the UI. A single Zustand store with localStorage persistence is the clean, correct solution. Small effort, high UX consistency impact.
- **Conditions**: The store must read from localStorage on initialization (not just write on toggle) to handle the case where the user set a preference in a previous session. Should respect the `prefers-color-scheme` media query as a default when no preference is stored.

## fix-token-expiry-handling.md
- **Verdict**: APPROVE
- **Reasoning**: Silent token expiry is one of the worst UX anti-patterns in authenticated apps. Users are working, their token expires, and suddenly they see raw "401 Unauthorized" errors with no explanation or recovery path. The phased approach (detect and surface expiry first, implement refresh later) is pragmatic. Checking `expiresAt` before injecting tokens in the Service Worker prevents a completely unnecessary round-trip to the API just to get a 401. Treating 401 as an auth-required state rather than a generic error gives users a clear recovery action.
- **Conditions**: The structured error response from the SW must be distinguishable from a real 401 from the API server. A 5-minute buffer before actual expiry (check `expiresAt - 300000 < Date.now()`) would prevent edge cases where the token expires during a request. The re-auth prompt must preserve the user's current location so they return to where they were after re-authenticating.

## systemic-accessibility-baseline.md
- **Verdict**: APPROVE
- **Reasoning**: This is the most thorough accessibility proposal, structured as three logical passes (structural semantics, interactive ARIA, visual accessibility) covering 22 of 31 accessibility findings. The pass-based approach makes it implementable in phases. It addresses every major ARIA gap: tree roles for the file explorer, tab roles for editor tabs, live regions for chat, button semantics for cards, and label associations for all form inputs. The visual accessibility pass (text-[10px] to text-xs, focus-visible on copy button) addresses low-vision users. The test plan includes automated axe-core, VoiceOver testing, and keyboard-only testing.
- **Conditions**: This overlaps substantially with `enhance-keyboard-navigation-and-accessibility.md`, `fix-a11y-fundamentals.md`, `fix-skip-nav-headings.md`, `fix-chat-textarea-label.md`, `fix-card-focus-indicator.md`, and `fix-priority-indicator.md`. If multiple accessibility proposals are approved, they MUST be deduplicated into a single implementation plan to avoid file conflicts. Recommend selecting either this systemic proposal OR the collection of targeted fixes -- not both. If this systemic proposal is chosen, the targeted fix proposals should be marked as subsumed.

## systemic-aria-semantics.md
- **Verdict**: ABSTAIN
- **Reasoning**: This proposal identifies the correct systemic problem (ARIA semantics are missing across the entire component library) but provides less implementation detail than `systemic-accessibility-baseline.md`, which covers the same scope with concrete code-level changes for each component. The test plan is also less specific. If the accessibility baseline proposal is approved, this one is redundant.
- **Conditions**: N/A -- superseded by systemic-accessibility-baseline.md.

## systemic-oauth-lifecycle.md
- **Verdict**: APPROVE
- **Reasoning**: This is the most complete auth lifecycle proposal, addressing the full vertical from UI button wiring through callback handling, token refresh, SW expiry awareness, and auth pre-checks on protected routes. The ProviderPicker type-casting fix (casting to `'github'` for non-GitHub providers) addresses a subtle correctness bug. The token refresh implementation (Phase 3) goes beyond the detect-and-surface approach of `fix-token-expiry-handling.md` by actually implementing refresh token flows, which is the correct long-term solution. Auth pre-checks on the IDE route prevent confusing unauthenticated API failures.
- **Conditions**: This is a Large effort and overlaps with `fix-auth-wiring.md` and `fix-token-expiry-handling.md`. If all three are approved, they must be deduplicated. Token refresh is provider-specific and complex -- the Atlassian and Google refresh flows should be implemented first (they use standard OAuth2 refresh tokens) with GitHub deferred if needed. The callback route error handling must cover consent denied, expired authorization codes, and network failures during token exchange.

## systemic-responsive-design.md
- **Verdict**: ABSTAIN
- **Reasoning**: This proposal describes the responsive gap at a high level and proposes creating responsive primitives (CollapsiblePanel, ResponsiveLayout, useMediaQuery). While architectural primitives are useful, the `systemic-responsive-layout.md` and `fix-responsive-layout.md` proposals provide more concrete implementation plans that can be executed without designing a responsive component framework first. The touch target requirement (44x44px) is good to call out but is better addressed in the specific component fixes.
- **Conditions**: N/A -- prefer the more concrete responsive layout proposals.

## systemic-responsive-layout.md
- **Verdict**: APPROVE
- **Reasoning**: This is the strongest responsive layout proposal: it combines the collapsible sidebar with Zustand state management, adaptive panel layouts per route, route-level code splitting, and the window.location.href -> client-side navigation fix. The Zustand layout store replacing DOM classList manipulation is architecturally correct. The route-level code splitting with TanStack Router's `lazyRouteComponent()` is a significant first-load performance improvement that also improves the responsive experience on mobile (less to download). The window.location.href fix prevents full-page reloads that destroy in-memory state -- a critical UX issue when navigating from an empty state CTA.
- **Conditions**: This overlaps with `fix-responsive-layout.md`, `enhance-responsive-layout.md`, and parts of `enhance-responsive-layout-and-performance.md`. Only one responsive layout proposal should be implemented. The hamburger menu icon must be a standard, recognizable pattern. Sidebar overlay on mobile should dismiss when clicking the backdrop. Lazy-loaded routes must have appropriate loading fallbacks (not blank screens).

## systemic-state-fragmentation.md
- **Verdict**: APPROVE
- **Reasoning**: This proposal identifies and fixes the root cause of multiple seemingly-unrelated bugs: theme desync, sidebar toggle desync, broken Escape-to-stop-streaming, inconsistent board IDs, and ErrorBoundary crash loops. The Zustand store approach for theme and layout state is the correct pattern. Moving the Escape-to-stop shortcut from a custom DOM event to a direct store action (with AbortController registration) is architecturally cleaner and eliminates the event-dispatch-with-no-listener gap. The constants module for DEFAULT_BOARD_ID addresses the inconsistency at the source. The ErrorBoundary cache invalidation on retry breaks the infinite crash loop.
- **Conditions**: This overlaps with `fix-theme-state-consolidation.md`, `fix-escape-stop-streaming.md`, `fix-board-default-id.md`, and `fix-sidebar-board-navigation.md`. If this systemic proposal is approved, the targeted fixes it subsumes should be marked as such. The AbortController registration pattern must be tested for cleanup on session end and component unmount to prevent memory leaks.

---

## Summary of Overlap Groups

Several proposals address the same underlying problems. To avoid implementation conflicts, only one proposal from each group should proceed to implementation:

**Accessibility group** (pick one systemic OR the collection of targeted fixes):
- systemic-accessibility-baseline.md (APPROVE -- recommended)
- enhance-keyboard-navigation-and-accessibility.md (APPROVE -- alternative)
- systemic-aria-semantics.md (ABSTAIN -- superseded)
- fix-a11y-fundamentals.md (APPROVE -- subset)
- fix-skip-nav-headings.md (APPROVE -- subset)
- fix-chat-textarea-label.md (APPROVE -- subset)
- fix-card-focus-indicator.md (APPROVE -- subset)
- fix-priority-indicator.md (APPROVE -- subset)

**Responsive layout group** (pick one):
- systemic-responsive-layout.md (APPROVE -- recommended)
- fix-responsive-layout.md (APPROVE -- alternative)
- enhance-responsive-layout.md (ABSTAIN -- superseded)
- enhance-responsive-layout-and-performance.md (REJECT -- too broad)
- systemic-responsive-design.md (ABSTAIN -- too abstract)

**Auth lifecycle group** (pick one systemic OR the collection of targeted fixes):
- systemic-oauth-lifecycle.md (APPROVE -- recommended)
- fix-auth-wiring.md (APPROVE -- subset)
- fix-token-expiry-handling.md (APPROVE -- subset)

**State management group** (pick one):
- systemic-state-fragmentation.md (APPROVE -- recommended)
- fix-theme-state-consolidation.md (APPROVE -- subset)
- fix-escape-stop-streaming.md (APPROVE -- subset)
- fix-sidebar-board-navigation.md (REJECT -- inferior approach)

**Board navigation**:
- fix-board-default-id.md (APPROVE -- recommended)
- fix-sidebar-board-navigation.md (REJECT -- hardcodes board ID 1)

**Error recovery group** (complementary, both can proceed):
- enhance-structured-error-recovery-and-auth-resilience.md (APPROVE)
- enhance-error-recovery-ux.md (APPROVE -- chat-specific subset)
