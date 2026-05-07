# Votes: Product Strategist

## growth-contextual-empty-states.md
- **Verdict**: APPROVE
- **Reasoning**: Empty states are the most cost-effective adoption lever available. Aegis's core value proposition -- collapsing 8 tool-switches into one tab -- is invisible if first-time users bounce at a blank screen before experiencing anything. This is table-stakes UX that every competitor (Linear, Cursor, github.dev) already ships, and its absence makes Aegis look unfinished regardless of how powerful the underlying platform is.
- **Conditions**: Prioritize the Board and Chat empty states over the Settings checklist. Copy should emphasize the zero-infrastructure, context-aware AI differentiators rather than generic onboarding language.

## growth-interactive-playground.md
- **Verdict**: APPROVE
- **Reasoning**: This is the single most important growth feature in the cycle. Aegis's differentiator -- context-aware AI backed by org knowledge, unified with a kanban board and browser IDE -- is impossible to explain in marketing copy. Users must experience it. A no-auth playground that demonstrates the board-to-chat-to-IDE flow with realistic sample data is the most powerful conversion tool available. The design doc already defines a Guest tier with public content access; the playground makes that tier actually useful.
- **Conditions**: The playground must demonstrate the context-aware AI advantage specifically -- the sample chat conversation should show the AI citing team coding standards and issue requirements, not just generic code completion. That is what differentiates Aegis from Cursor/Copilot. Keep the sample data small (the proposed ~5KB is correct) and resist the temptation to make it comprehensive.

## growth-keyboard-shortcuts-command-palette.md
- **Verdict**: REJECT
- **Reasoning**: This proposal is a superset that combines the command palette and keyboard shortcuts, both of which are proposed separately as dedicated features (power-command-palette.md and power-keyboard-shortcuts.md). Approving this alongside those dedicated proposals creates scope ambiguity and overlapping ownership. The dedicated proposals are better scoped and should be the vehicles for this work.
- **Conditions**: N/A

## growth-progressive-auth-nudges.md
- **Verdict**: APPROVE
- **Reasoning**: This directly attacks the highest-friction moment in the outside contributor journey: the modal-blocking LLM provider setup. The design doc's progressive auth vision (section 4.3) is undermined by the current modal execution. Inline provider setup that keeps users in context, combined with Ollama auto-detection, creates a "just works" path that no competitor in this space offers. Cursor and Windsurf solve this by being local apps; Aegis being browser-only makes frictionless provider setup even more critical to the value proposition.
- **Conditions**: The Ollama auto-detection must fail silently and quickly (sub-200ms timeout). Do not deprecate the OnboardingWizard in this cycle -- move it to Settings-only, but do not remove it. Some enterprise users prefer batch account setup.

## growth-shareable-deep-links.md
- **Verdict**: APPROVE
- **Reasoning**: Deep links are the viral growth engine for browser-first tools. Every link pasted in Slack or a PR description is free user acquisition. Aegis's browser-only, zero-infrastructure positioning means URLs are the product's distribution mechanism -- unlike Cursor or VS Code, there is no "download" step. The link IS the entry point. Board filter persistence in URLs also directly improves daily usability for existing users, which strengthens retention.
- **Conditions**: Prioritize board filter URL params and IDE file+line deep links (highest daily usage). Chat message anchors are lower priority and can be deferred if time is tight. The auth redirect preservation pattern should be shared with the progressive-auth-nudges proposal to avoid duplicating the sessionStorage logic.

## platform-cache-eviction-and-quota.md
- **Verdict**: APPROVE
- **Reasoning**: Aegis's zero-infrastructure promise means the browser IS the infrastructure. If IndexedDB silently fills up and data is lost, the "no server to operate" advantage becomes "no server to debug." Safari's 1GB quota makes this a real threat for power users who are exactly the audience Aegis needs to retain. This is unsexy but essential infrastructure that prevents a catastrophic UX failure for the most engaged users.
- **Conditions**: The Settings storage panel (part 4) can be deferred to a later cycle. Focus on the automated eviction scheduler and quota-aware writes first. Users should not need to manually manage cache -- that contradicts the zero-infrastructure vision.

## platform-llm-context-budget.md
- **Verdict**: APPROVE
- **Reasoning**: Context-aware AI is Aegis's primary differentiator. If long conversations silently truncate the org context that makes the AI valuable, the differentiator evaporates mid-session. Users will blame Aegis ("the AI stopped following our coding standards") when the real problem is context overflow pruning away the system prompt. This feature protects the core value proposition. The token budget visualization also makes Aegis's context management transparent in a way that competitors like ChatGPT and Copilot do not -- a potential differentiator in itself.
- **Conditions**: Ship phases 1 (tool result pruning) and 3 (hard truncation) first. Phase 2 (AI-powered summarization) adds cost and latency and should be opt-in or deferred. The system prompt budget cap (30% max for org context) is the most critical piece -- prioritize it above conversation compaction.

## platform-offline-resilience.md
- **Verdict**: APPROVE
- **Reasoning**: The design doc explicitly claims offline capability as strength #7. Shipping a product that claims offline support but fails entirely when offline is worse than not claiming it at all -- it erodes trust. The stale-while-revalidate configuration for TanStack Query is near-zero effort and delivers immediate value. The mutation queue with retry is the right architecture for a browser-first tool that operates against cloud APIs.
- **Conditions**: Scope to read-path resilience (stale-while-revalidate, VFS tree persistence) and the online/offline indicator in this cycle. The full mutation queue with IndexedDB persistence and the pending changes panel can be phase 2. The online/offline indicator is essential -- users must know they are operating on cached data.

## platform-resilient-api-fetch.md
- **Verdict**: APPROVE
- **Reasoning**: This is a small, high-leverage infrastructure investment. The design doc identifies Jira rate limits (section 13.1) and GitHub rate limits (section 13.3) as top risks. A resilient fetch layer is the mitigation. The effort estimate (S, ~150 lines) is proportional to the value, and request deduplication alone prevents a class of redundant API calls that waste rate limit budget. This hardens the platform for the power users Aegis must retain.
- **Conditions**: None. Ship as specified.

## platform-structured-error-recovery.md
- **Verdict**: APPROVE
- **Reasoning**: Aegis collapses 8 tool-switches into one tab, which means errors from 4 different APIs (Jira, GitHub, LLM, Google Auth) all surface in the same UI. If every error looks the same ("Something went wrong"), users cannot self-recover and will abandon the platform. Structured error recovery with contextual actions (re-authenticate on 401, pull latest on conflict) is essential for a multi-API browser app. The auth-expired interceptor is particularly important -- token expiry during a multi-step workflow (edit, commit, PR, transition) is the most likely and most damaging failure mode.
- **Conditions**: The error history panel (part 3) is nice-to-have and can be deferred. Focus on error classification, the action-mapped toasts, and the auth-expired interceptor. These three deliver 90% of the user-facing value.

## power-command-palette.md
- **Verdict**: APPROVE
- **Reasoning**: The command palette is how keyboard-centric developers navigate any tool. Its absence is the single most noticeable gap for the power-user persona (Red Hat engineers who live in VS Code and terminal). The proposal correctly combines Linear's issue search with VS Code's file/command modes, which matches Aegis's unique position as a kanban+IDE hybrid. This is the kind of feature that makes users say "this tool gets me" -- critical for retention.
- **Conditions**: Coordinate implementation with power-keyboard-shortcuts.md and power-ide-file-search.md to share the fuzzy matching utility and ensure consistent shortcut registration patterns. The file mode (`>` prefix) should only be implemented if IDE file search ships in the same cycle; otherwise defer it.

## power-ide-file-search.md
- **Verdict**: APPROVE
- **Reasoning**: File navigation by fuzzy search (Cmd+P) is the most-used feature in VS Code and the most-missed feature in any IDE that lacks it. Since Aegis positions its IDE for "focused, issue-scoped edits" (design doc section 7.5), fast file navigation is even more important -- developers need to quickly find the specific files relevant to their issue. The fact that the VFS tree is already in memory means this is nearly free to implement. Go-To-Symbol and Go-To-Line are one-liner Monaco triggers that punch well above their implementation weight.
- **Conditions**: Implementation should share the fuzzy matching infrastructure with the command palette. If the command palette ships with a `>` file mode, the standalone FileFinder can be a thin wrapper that opens the palette in file mode rather than a separate component.

## power-keyboard-shortcuts.md
- **Verdict**: APPROVE
- **Reasoning**: This is the foundational layer that the command palette and other power-user features build on. The layered, context-scoped shortcut system (board shortcuts active only on board, IDE shortcuts only in IDE) is the right architecture. Board shortcuts (J/K navigation, C for chat, E for IDE) directly accelerate the core workflow loop that defines Aegis: see issue on board, chat about it, code it in IDE. These shortcuts make the board-to-chat-to-IDE transition nearly instant, which reinforces the "one tab" value proposition.
- **Conditions**: Ship this before or alongside the command palette -- the shortcut registry and useHotkeys hook are shared infrastructure. Be conservative with Cmd+W in IDE context; intercepting browser-level shortcuts is risky and should be opt-in or documented clearly.

## power-quick-issue-actions.md
- **Verdict**: APPROVE
- **Reasoning**: This transforms the board from a visualization layer into a productivity surface. Red Hat scrum leads processing 20-30 issues after standup need context menus and batch operations -- this is a workflow they already have in Jira Cloud's list view and will immediately miss in Aegis. "Assign to me" as a single right-click action is the kind of micro-interaction that earns daily usage. Multi-select with batch transitions is a power-user feature that creates switching cost -- once a scrum lead depends on it, they will not go back to clicking through individual cards.
- **Conditions**: Ship Part 1 (context menu) and Part 3 (hover quick-edit) first. Part 2 (multi-select and batch actions) is higher effort and can follow in a subsequent cycle. The context menu alone delivers most of the value for the triage use case.

## power-recent-activity-and-quick-switch.md
- **Verdict**: APPROVE
- **Reasoning**: The sidebar "Recent" section and Ctrl+Tab quick-switch directly address the multi-issue workflow that is the reality for Red Hat engineers (3-5 issues per day, frequent context switches). This feature makes the issue-scoped routing model (which is Aegis's structural advantage) practical for real multi-tasking. The activity indicator dots (blue for active chat, green for uncommitted changes) add situational awareness that no competitor provides in this specific kanban+IDE context -- a genuine differentiator.
- **Conditions**: Ship Part 1 (sidebar recent) and Part 3 (activity dots) first. Part 2 (Ctrl+Tab quick-switch) has implementation risk around modifier key tracking on different platforms and can follow. Cap the sidebar at 5 items initially (not 8) to avoid clutter on smaller screens.
