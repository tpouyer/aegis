# Feature: Contextual Empty States with Guided Next Actions

## User Story
As a newly authenticated contributor, I want clear guidance on what to do next when I land on an empty board or open a chat for the first time so that I don't feel lost or abandoned after sign-in.

## Problem
After a contributor completes the onboarding wizard and connects GitHub, they are dropped onto the board route (`/board/default`) with no board configured. The current implementation shows either a loading spinner that never resolves (no Jira board ID configured) or a generic error message ("Failed to load board"). There is no guidance on what to do next, how to configure a board, or how to reach a productive state.

This is a critical drop-off point. Research from Mixpanel and Amplitude consistently shows that 40-60% of users who sign up for developer tools churn within the first session if they cannot reach a meaningful outcome within 2-3 minutes.

Evidence from comparable tools:
- **Linear** shows a polished empty state with "Create your first issue" and a quick-start checklist.
- **Shortcut** provides a "Getting Started" project pre-loaded with tutorial stories.
- **GitHub Projects** shows "This project doesn't have any items yet" with an "Add item" button and suggested workflows.

In Aegis today, every major view (board, chat, IDE) has a failure mode where the user sees nothing useful and has no affordance to recover.

## Proposed Solution
Replace blank/error screens with contextual empty states across all three primary views:

### Board Empty State
When no board is configured or the board ID is invalid:
- Illustration or icon indicating "No board connected"
- Heading: "Connect a Jira board to get started"
- Body text explaining what the board does (drag-and-drop transitions, AI chat from cards, IDE from cards)
- Primary CTA: "Configure Board" (links to Settings or opens a board-picker dialog)
- Secondary CTA: "Try the Playground" (links to `/playground` if that feature exists)
- Tertiary: link to the design doc or a brief inline tutorial

### Chat Empty State
When a user opens `/issue/:key/chat` without an LLM provider configured:
- The current behavior opens the ProviderPicker dialog, which is good but jarring without context.
- Add a friendly preamble below the chat header explaining: "Aegis AI knows your team's coding standards, the issue requirements, and your repo's architecture. Configure an LLM provider to start chatting."
- Show a quick comparison of provider options (free/paid, tool-use support) as inline cards rather than only in the dialog.
- After provider is configured, show a welcome message from the AI: "I have context about {issueKey}. Ask me about implementation approaches, coding standards, or anything about this issue."

### IDE Empty State
When a user opens `/issue/:key/ide` but the issue has no component-to-repo mapping:
- Show the IDE layout shell (explorer + editor + chat panels) with a centered message in the editor area
- Heading: "No repository linked to this issue"
- Body: "Aegis maps Jira components to GitHub repositories. This issue's component hasn't been mapped yet."
- CTA: "Select a repository" (opens a repo-picker that lets the user manually specify org/repo)
- Secondary: "How repo mapping works" (expandable inline explanation)

### Settings Empty State
When no connections are established:
- Show a progress checklist: "Set up Aegis in 3 steps: 1. Connect GitHub (required), 2. Connect Jira (recommended), 3. Configure AI provider (recommended)"
- Each step has a status indicator (done/pending) and a single-click action button

## Impact Assessment
- User impact: **High** -- empty states are the #1 reason first-time users bounce. Every dead-end screen that lacks guidance is an adoption leak. This feature plugs all of them.
- Effort estimate: **S** -- each empty state is a small presentational component (50-100 lines) inserted into existing view components with conditional rendering. No new routes, no state management changes, no API work.
- Risk: Minimal. Empty states are purely additive UI. The only risk is that copy/messaging doesn't resonate, which is easily iterated on.

## Competitive Analysis
| Tool | Empty State Quality | Notes |
|---|---|---|
| Linear | Excellent | Illustrated empty states with clear CTAs, onboarding checklist |
| Shortcut | Good | Pre-loaded tutorial project, contextual help |
| GitHub Projects | Good | Clear "add item" affordance, suggested templates |
| Cursor | Good | Opens with a welcome tab showing keyboard shortcuts and quick actions |
| Windsurf | Good | Similar to Cursor, guided first-run experience |
| github.dev | N/A | Always opens on a repo, so no empty state needed |
| **Aegis (today)** | Poor | Loading spinners, generic errors, no guidance |

## Technical Sketch

**New files:**
- `src/components/board/BoardEmptyState.tsx` -- empty state for unconfigured/missing board
- `src/components/chat/ChatWelcome.tsx` -- welcome message and provider guidance
- `src/components/ide/IDEEmptyState.tsx` -- repo-not-mapped guidance
- `src/components/shared/SetupChecklist.tsx` -- reusable progress checklist (used in Settings and optionally on the landing page)

**Modified files:**
- `src/components/board/BoardView.tsx` -- render `BoardEmptyState` when `boardConfig` is null/undefined (before the error state, as a distinct case from API failure)
- `src/components/chat/ChatView.tsx` -- render `ChatWelcome` as the first message when session is newly created and has zero messages
- `src/components/ide/IDELayout.tsx` -- render `IDEEmptyState` in the editor panel when no repo is resolved from the issue's component
- `src/routes/settings.tsx` -- add `SetupChecklist` at the top of the Connections tab when fewer than 2 providers are connected

**Approach:**
- Each empty state component is self-contained, uses existing Shadcn primitives (Card, Button, Badge), and follows the established Tailwind patterns.
- No new dependencies. No state management changes. Pure presentational components with callback props for CTAs.
- Copy is written for outside contributors (not Red Hat employees) as the primary audience, consistent with the growth focus.
