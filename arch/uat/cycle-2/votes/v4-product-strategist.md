# V4: Product Strategist Ballot — Cycle 2

## Summary

23 proposals evaluated. This ballot prioritizes unblocking the end-to-end user journey (auth is the #1 blocker), foundational accessibility (legal and ethical obligation), and responsive design (defines the addressable market). Overlapping proposals are flagged -- only the most comprehensive version should proceed.

---

## fix-auth-wiring.md
- **Verdict**: APPROVE
- **Reasoning**: This is the single highest-impact fix in the entire cycle. Zero users can authenticate today -- Board, IDE, and commit features are completely inaccessible. Every other proposal that depends on a working app is downstream of this. The effort-to-impact ratio is exceptional: medium effort to unblock 100% of authenticated user journeys across all three personas (Outside Contributor, Red Hat Employee, Guest upgrading).
- **Conditions**: Must include the Atlassian cloudId resolution step so JiraClient actually initializes. Callback route must handle errors gracefully (not a white screen on OAuth failure). Must be merged before any error-recovery or auth-nudge proposals.

## fix-board-default-id.md
- **Verdict**: APPROVE
- **Reasoning**: Every navigation path to the board is broken -- sidebar, landing page, keyboard shortcut, and command palette all fail. This is a tiny fix (S effort) that unblocks the core board experience for every persona. Combined with fix-auth-wiring, this makes the board actually reachable. The proposal to handle 'default' gracefully and show a board picker is the right approach -- hardcoding '1' (as fix-sidebar-board-navigation suggests) is fragile.
- **Conditions**: Must handle the 'default' board ID case gracefully, not just swap to a hardcoded numeric ID. Should show auth-required empty state when Jira is not connected.

## fix-sidebar-board-navigation.md
- **Verdict**: REJECT
- **Reasoning**: This is a narrower, less thoughtful version of fix-board-default-id.md. Hardcoding boardId='1' everywhere is a band-aid that breaks for any user whose first board is not ID 1. The fix-board-default-id proposal handles this correctly by treating 'default' as a valid concept that resolves dynamically. Approving both would create conflicting implementations.
- **Conditions**: N/A

## fix-escape-stop-streaming.md
- **Verdict**: APPROVE
- **Reasoning**: A keyboard shortcut that does nothing is worse than no shortcut at all -- it teaches users the app is broken. This is S effort for a critical chat UX fix that affects power users and new contributors alike. The fix is surgical (one useEffect) with zero risk of regression.
- **Conditions**: None. Ship it.

## fix-provider-switch.md
- **Verdict**: APPROVE
- **Reasoning**: Users who try multiple LLM providers (a core differentiator of Aegis's 5-provider architecture) hit a silent failure. This undermines the multi-provider value proposition. S effort, clean fix, directly serves power users who are the most likely to explore providers.
- **Conditions**: Verify that switching providers preserves message history. Add a brief visual confirmation (toast or inline indicator) that the provider was changed.

## fix-double-text-filter.md
- **Verdict**: APPROVE
- **Reasoning**: Search returning zero results when matches exist is a trust-destroying bug. Power users who rely on text search will conclude the board is broken. S effort fix that removes code rather than adding it -- the safest kind of change.
- **Conditions**: Verify the JQL text search alone provides adequate filtering before removing client-side. Ensure no other client-side filters are accidentally removed.

## fix-abort-signal-providers.md
- **Verdict**: APPROVE
- **Reasoning**: Three of five LLM providers ignore the abort signal, meaning Stop does nothing for Vertex AI, Ollama, and Custom provider users. This wastes API quota (real money for users providing their own keys) and leaves zombie connections. S effort, zero regression risk, fixes the custom.ts endpoint reference bug as a bonus.
- **Conditions**: None.

## fix-token-expiry-handling.md
- **Verdict**: APPROVE
- **Reasoning**: After auth is wired (fix-auth-wiring), token expiry is the next blocker users will hit -- Atlassian tokens expire hourly. Without this fix, every user's session degrades within an hour to raw 401 errors with no recovery path. This is a critical reliability fix that directly prevents user churn. The phased approach (detect-and-surface now, refresh-tokens later) is pragmatic.
- **Conditions**: Must coordinate with fix-auth-wiring on the AuthManager API surface. The structured 401 response from the SW must be a well-defined contract so other components can rely on it.

## fix-card-focus-indicator.md
- **Verdict**: APPROVE
- **Reasoning**: The j/k keyboard navigation exists but is invisible -- this makes the feature actively confusing rather than useful. S effort to complete an already-built feature. Serves both power users (keyboard efficiency) and accessibility users (visible focus state is WCAG 2.4.7 Level AA). This is also a prerequisite for the cycle-1 approved power-quick-issue-actions feature.
- **Conditions**: Focus ring must have sufficient contrast ratio (3:1 minimum per WCAG). Card should scroll into view when focused via keyboard.

## fix-chat-textarea-label.md
- **Verdict**: APPROVE
- **Reasoning**: Missing accessible label on the primary chat input is a WCAG Level A violation (1.3.1). S effort, zero visual impact, legally required for accessibility compliance. The command palette aria-activedescendant fix is a nice bonus.
- **Conditions**: None.

## fix-priority-indicator.md
- **Verdict**: APPROVE
- **Reasoning**: Color-only information encoding violates WCAG 1.4.1 (Level A) and affects approximately 8% of male users. S effort for a meaningful accessibility win on a frequently-viewed component. However, the proposed solution still uses `text-[10px]` which another UAT finding flagged as too small -- use `text-xs` (12px) minimum.
- **Conditions**: Use `text-xs` not `text-[10px]` for the badge text size. Ensure the badge does not cause card layout overflow with longer priority names like "Highest" or "Lowest".

## fix-skip-nav-headings.md
- **Verdict**: APPROVE
- **Reasoning**: Skip navigation and heading hierarchy are fundamental WCAG Level A requirements (2.4.1, 2.4.2, 1.3.1). Without them, screen reader users cannot navigate the app at all. S effort for foundational accessibility infrastructure that every future page benefits from. This proposal is well-scoped and avoids the scope creep of the larger a11y proposals.
- **Conditions**: Dynamic page titles should include route-specific context (e.g., issue key in chat/IDE routes, not just "Chat - Aegis"). Consider a shared `usePageTitle()` hook to keep implementations consistent.

## fix-theme-state-consolidation.md
- **Verdict**: APPROVE
- **Reasoning**: Theme toggling in one place and not reflecting in others is a polish issue that erodes user trust in the app's reliability. S effort, clean Zustand store pattern that also fixes the command palette DOM manipulation anti-pattern. Serves all personas since dark mode is universal.
- **Conditions**: The store should be initialized from localStorage on creation to avoid a flash of wrong theme on page load. Consider naming the store file `layout.ts` instead of `theme.ts` if the responsive layout proposals also need a layout store -- avoid creating two overlapping stores.

## fix-responsive-layout.md
- **Verdict**: APPROVE
- **Reasoning**: The app being completely unusable below 1024px excludes a large portion of potential users (mobile web traffic is 50%+ globally). This is the right-sized responsive layout fix -- M effort, focused on the core layout components, pragmatic Tailwind breakpoint approach rather than over-engineering with custom primitives. This is a market-defining fix for a tool marketed as zero-infrastructure.
- **Conditions**: Must coordinate with fix-theme-state-consolidation on the UI store (avoid creating duplicate stores). The Zustand sidebar state should be the single source of truth for both proposals. Must not break the existing desktop layout.

## fix-a11y-fundamentals.md
- **Verdict**: APPROVE
- **Reasoning**: This is the best-scoped accessibility proposal -- it tackles the 7 most critical WCAG Level A violations at S effort. It overlaps with fix-skip-nav-headings and fix-chat-textarea-label but is more comprehensive than either individually. From a product strategy perspective, I would prefer this as the single a11y fix rather than the individual ones, but if the individual fixes are also approved, implementers should consolidate.
- **Conditions**: If fix-skip-nav-headings AND fix-chat-textarea-label AND fix-priority-indicator are all approved individually, this proposal should be the canonical implementation and the others should be marked as subsumed. Avoid duplicate work.

## enhance-progressive-auth-nudges.md
- **Verdict**: APPROVE
- **Reasoning**: The OnboardingWizard is fully built but never shown -- this is wasted engineering that represents real user value. Progressive auth nudges are a growth lever: converting Guests to authenticated users is the primary funnel for Aegis adoption. This directly serves the New Contributor persona's first-visit experience. However, it has significant overlap with fix-auth-wiring -- the callback route and button wiring are nearly identical.
- **Conditions**: Must be implemented AFTER fix-auth-wiring, not in parallel. The callback route from fix-auth-wiring should be reused. This proposal's unique value is the OnboardingWizard rendering and progressive nudges -- the auth button wiring should come from fix-auth-wiring.

## enhance-error-recovery-ux.md
- **Verdict**: ABSTAIN
- **Reasoning**: This is a reasonable proposal but is entirely subsumed by enhance-structured-error-recovery-and-auth-resilience.md, which covers all four items here plus error classification, global 401 interception, enhanced toasts, and SPA navigation fixes. Approving both would create conflicting implementations. I neither approve nor reject because the intent is good, but the comprehensive version is strictly better.
- **Conditions**: If enhance-structured-error-recovery-and-auth-resilience is rejected, this should be reconsidered as the lighter alternative.

## enhance-structured-error-recovery-and-auth-resilience.md
- **Verdict**: APPROVE
- **Reasoning**: This is the most architecturally sound proposal in the cycle. It creates a proper error classification layer that every future feature benefits from, fixes the ErrorBoundary infinite loop (a critical UX bug), replaces raw API errors with actionable recovery guidance, and fixes the `window.location.href` navigation anti-pattern that destroys SPA state. The M effort rating is aggressive but achievable because the changes are well-localized. This directly enables the cycle-1 approved platform-structured-error-recovery and partially delivers growth-progressive-auth-nudges.
- **Conditions**: Must be implemented AFTER fix-auth-wiring and fix-token-expiry-handling so the error classification layer builds on working auth infrastructure. The ErrorCategory enum should be exported as a public API for other components. The toast action buttons must be keyboard-accessible.

## enhance-keyboard-navigation-and-accessibility.md
- **Verdict**: APPROVE
- **Reasoning**: This is the most comprehensive accessibility proposal and directly delivers two cycle-1 approved features (power-quick-issue-actions card context menu and power-ide-file-search prerequisite). It addresses 22 distinct UAT findings across all personas. The card context menu providing a keyboard DnD alternative is a genuine differentiator -- most kanban tools do not have this. The L effort is justified by the breadth. However, it has massive overlap with fix-a11y-fundamentals, fix-skip-nav-headings, fix-card-focus-indicator, fix-chat-textarea-label, fix-priority-indicator, and systemic-aria-semantics.
- **Conditions**: This MUST be the canonical accessibility implementation. All overlapping individual fix proposals (skip-nav, chat-label, priority, card-focus, systemic-aria) should be treated as subsumed by this proposal to avoid duplicate and conflicting work. Implementation should be phased: skip-nav and headings first (unblocks screen readers), then board keyboard (unblocks power users), then IDE and chat semantics.

## enhance-responsive-layout.md
- **Verdict**: REJECT
- **Reasoning**: This is a subset of fix-responsive-layout.md with nearly identical content (same sidebar, IDE, chat panel changes). The fix-responsive-layout version is more thorough (includes FilterBar wrapping, command palette store fix, slide-over overlay for mobile sidebar). There is no reason to approve both.
- **Conditions**: N/A

## enhance-responsive-layout-and-performance.md
- **Verdict**: APPROVE
- **Reasoning**: This is the most comprehensive and ambitious proposal in the cycle. Beyond responsive layout (which overlaps with fix-responsive-layout), it uniquely addresses: route-level code splitting, board virtualization, chat streaming performance, cache eviction, and touch targets. These performance fixes are essential for production readiness -- 100+ cards without virtualization is a real scalability wall, and the streaming store's O(n) allocations will cause visible jank. The model display name fix and Wave 3 placeholder removal are small polish items that improve first impressions. It also delivers cycle-1 approved platform-cache-eviction and platform-offline-resilience.
- **Conditions**: This should subsume fix-responsive-layout.md and fix-theme-state-consolidation.md to avoid duplicate work on sidebar/theme state. Implementation must be phased: (1) responsive layout and theme consolidation, (2) code splitting and virtualization, (3) streaming performance and cache eviction. Do not attempt all at once. The @tanstack/react-virtual dependency must be added to package.json. Virtualization must not break drag-and-drop on board cards.

## systemic-aria-semantics.md
- **Verdict**: ABSTAIN
- **Reasoning**: The diagnosis is correct -- ARIA semantics are systematically missing across the app. However, this proposal is more of a problem statement than a solution; it lacks the specificity of enhance-keyboard-navigation-and-accessibility.md, which covers the same ground with concrete implementation details. If the comprehensive a11y enhancement is approved, this systemic proposal is redundant. If it is rejected, this proposal is too vague to act on.
- **Conditions**: If enhance-keyboard-navigation-and-accessibility is rejected, this should be fleshed out with specific implementation details before re-proposing.

## systemic-responsive-design.md
- **Verdict**: REJECT
- **Reasoning**: The "responsive primitives" approach (CollapsiblePanel, ResponsiveLayout wrapper, useMediaQuery hook) adds unnecessary abstraction for what is fundamentally a Tailwind breakpoint problem. The fix-responsive-layout and enhance-responsive-layout-and-performance proposals solve the same problems more directly using Tailwind's built-in responsive utilities without creating new component abstractions. Over-engineering the responsive layer adds complexity and delays delivery.
- **Conditions**: N/A

---

## Consolidation Recommendations

The 23 proposals have significant overlap. To avoid duplicate work, I recommend the following consolidation:

**Tier 1 -- Ship Immediately (S effort, unblock users):**
- fix-auth-wiring (complete blocker)
- fix-board-default-id (board unreachable)
- fix-escape-stop-streaming
- fix-provider-switch
- fix-double-text-filter
- fix-abort-signal-providers

**Tier 2 -- Core Foundations (M effort, canonical implementations):**
- fix-token-expiry-handling (subsumes token aspects of enhance-error-recovery-ux)
- enhance-structured-error-recovery-and-auth-resilience (subsumes enhance-error-recovery-ux)
- enhance-progressive-auth-nudges (after fix-auth-wiring)

**Tier 3 -- Comprehensive Sweeps (L effort, subsume smaller proposals):**
- enhance-keyboard-navigation-and-accessibility (subsumes fix-a11y-fundamentals, fix-skip-nav-headings, fix-card-focus-indicator, fix-chat-textarea-label, fix-priority-indicator, systemic-aria-semantics)
- enhance-responsive-layout-and-performance (subsumes fix-responsive-layout, fix-theme-state-consolidation, enhance-responsive-layout, systemic-responsive-design)

If the L-effort proposals are rejected, fall back to the individual S-effort fixes they subsume.
