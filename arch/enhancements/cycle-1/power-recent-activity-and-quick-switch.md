# Feature: Recent Activity Feed and Quick-Switch Between Issues

## User Story
As a Red Hat developer juggling multiple issues throughout the day, I want a recent activity feed and the ability to quickly switch between the last few issues I worked on so that I can context-switch efficiently without losing my place.

## Problem
Aegis routes are issue-scoped (`/issue/:key/chat`, `/issue/:key/ide`), which is excellent for focus. But when a developer needs to switch between issues -- a common pattern when waiting for CI, reviewing a colleague's question, or triaging a new bug -- they must navigate back to the board, visually locate the card, and click through to the target view. There is no "recent issues" list, no back-stack of visited issues, and no quick-switch mechanism.

The Sidebar currently shows only three static links: Home, Board, Settings. It does not reflect the user's recent work or open sessions. The chat store persists sessions in IndexedDB, and the IDE store tracks open tabs, but neither surfaces this state in the navigation UI.

VS Code's "recently opened" (Ctrl+R) and JetBrains' "recent files" (Cmd+E) are muscle-memory features for developers. Linear shows recently viewed issues in the sidebar. Jira shows "recent issues" in its global search. Chrome and Arc browsers show recent tabs. The pattern is universal: power users navigate by recency, not by hierarchy.

## Proposed Solution

### Part 1: Recent Issues in Sidebar
Extend the Sidebar component with a "Recent" section that shows the last 8 issues the user navigated to (chat or IDE), ordered by most recent first. Each entry shows:
- Issue key (e.g., `AAP-1234`)
- Truncated summary
- An icon indicating the last view used (chat bubble or code icon)
- Clicking navigates to the last view for that issue

Data source: a `recentIssues` array in a new lightweight store, persisted in localStorage. Updated every time the user navigates to a `/issue/:key/*` route.

### Part 2: Quick-Switch Shortcut (Cmd+Tab style)
- `Ctrl+Tab` opens a small floating panel listing the 5 most recently visited issue views.
- Holding `Ctrl` and pressing `Tab` again cycles through the list (like OS window switching).
- Releasing `Ctrl` navigates to the highlighted issue/view.
- This is the same interaction pattern as VS Code's editor tab switching and browser tab switching.

### Part 3: Activity Indicator Dots
On the Sidebar "Recent" items, show subtle status indicators:
- Blue dot: active chat session (messages in the last hour)
- Green dot: has uncommitted IDE changes
- No dot: idle

These indicators are derived from existing store state (chat sessions, VFS changes) with no new API calls.

## Impact Assessment
- User impact: **Medium-High** -- directly addresses context-switching friction, which is the second most common workflow after single-issue focus. Red Hat engineers typically work 3-5 issues per day, so quick-switch saves 20-30 navigation round-trips daily.
- Effort estimate: **S** -- the Sidebar already exists and needs only a new section. Route change tracking is a one-line TanStack Router subscription. The quick-switch panel is a lightweight overlay. All data is local (no API calls).
- Risk: The sidebar could feel cluttered with too many recent items on small screens. Mitigation: cap at 8 items, use compact single-line rendering, allow collapsing the Recent section.

## Competitive Analysis
| Tool | Recent items location | Quick-switch | Data source |
|------|----------------------|-------------|-------------|
| VS Code | Ctrl+R (dialog), sidebar recent | Ctrl+Tab (editor tabs) | Local file history |
| JetBrains | Cmd+E (recent files popup) | Ctrl+Tab | Local editor history |
| Linear | Sidebar "Recent" section | Cmd+K recent results | Server-side activity |
| Jira | Global search "Recent" | None | Server-side view history |
| Chrome | Cmd+Shift+A (tab search) | Ctrl+Tab | Open tabs |

Aegis's approach combines Linear's sidebar persistence with VS Code's Ctrl+Tab switching, adapted for issue-scoped navigation.

## Technical Sketch

**New files:**
- `stores/activity.ts` -- `recentIssues: Array<{issueKey, summary, lastView, lastVisited, hasChanges}>`, persisted to localStorage, max 20 entries
- `components/shared/QuickSwitch.tsx` -- floating overlay for Ctrl+Tab issue switching

**Modified files:**
- `components/shared/Sidebar.tsx` -- add "Recent" section rendering `recentIssues` from the activity store, with status dots
- `routes/__root.tsx` -- subscribe to TanStack Router's `afterLoad` or navigation event to record issue visits in the activity store
- `routes/issue.$issueKey.chat.tsx` -- record visit on mount
- `routes/issue.$issueKey.ide.tsx` -- record visit on mount

**Approach:**
1. `activity.ts` store: `addVisit(issueKey, summary, view)` prepends to the list, deduplicates by key, caps at 20.
2. Persistence: `zustand/middleware` persist to localStorage (simple, no IndexedDB needed for 20 small objects).
3. Sidebar "Recent" section: map over `recentIssues.slice(0, 8)`, render as compact links with `<Link to={...}>`.
4. Status dots: derive from `useChatStore` (session exists and has recent messages) and `useIDEStore` (dirty tabs for that issue's repo).
5. Quick-switch: register `Ctrl+Tab` at root. On keydown, show overlay. On subsequent Tab (while Ctrl held), move highlight. On Ctrl keyup, navigate and close. This follows the standard OS window-switcher pattern.
6. Route tracking: in each issue route's component, call `useEffect(() => { activityStore.addVisit(issueKey, ...) }, [issueKey])`.
