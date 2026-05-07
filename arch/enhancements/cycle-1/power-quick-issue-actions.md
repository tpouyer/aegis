# Feature: Quick Issue Actions (Inline Batch Operations)

## User Story
As a Red Hat scrum lead triaging a backlog in Aegis, I want to right-click a card or press a key to instantly assign, set priority, add labels, or bulk-transition multiple issues so that I can process a 30-card board in minutes instead of opening each card individually.

## Problem
Today, every mutation on a Jira issue requires: (1) click the card to open CardDetail, (2) find the field, (3) change it, (4) close the panel. For a scrum master triaging 20 issues after standup, this is 80+ clicks for what should be 20 quick actions. There is no multi-select or batch operation capability.

The board's `Card.tsx` component currently shows issue key, summary, priority badge, components, assignee avatar, story points, and two action buttons (AI Chat, Open IDE). There is no context menu and no way to act on an issue without fully opening it.

Linear solves this with inline actions: hover a card and see quick-action icons; right-click for a context menu with assignee, priority, status, label, and due date. Jira's own list view supports bulk editing by selecting multiple issues. Power users expect these interaction patterns.

## Proposed Solution

### Part 1: Card Context Menu
Right-clicking a card (or pressing `Space` when focused via keyboard) opens a context menu with:

- **Assign to me** -- one-click self-assignment (calls `PUT /rest/api/3/issue/{key}` with current user's accountId)
- **Set priority** -- submenu: Highest, High, Medium, Low, Lowest
- **Set assignee** -- submenu: list of team members (from cached board data)
- **Transition to** -- submenu: available transitions (pre-fetched, same as drag-drop)
- **Add label** -- submenu: existing labels from board issues + free-text input
- **Open chat** -- navigate to chat view
- **Open IDE** -- navigate to IDE view
- **Copy issue key** -- copy `AAP-1234` to clipboard

### Part 2: Multi-Select and Batch Actions
- Click a card while holding `Cmd` (macOS) / `Ctrl` to add it to a selection.
- Click while holding `Shift` to select a range within a column.
- A floating action bar appears at the bottom when 2+ cards are selected: "N issues selected | [Assign] [Priority] [Transition] [Clear]".
- Batch actions call Jira's bulk API or loop individual calls with a progress indicator.

### Part 3: Inline Quick-Edit Chips
On card hover, show small action icons overlaid on the card:
- Assignee avatar (click to reassign)
- Priority icon (click to cycle)
These mirror Linear's hover affordances.

## Impact Assessment
- User impact: **High** -- directly addresses the #1 complaint of Jira power users: too many clicks to do simple operations. Batch transition alone saves 5-10 minutes per triage session.
- Effort estimate: **M** -- Part 1 (context menu) is S effort using Radix DropdownMenu. Part 2 (multi-select) adds a selection model to the board store and a floating bar component. Part 3 (hover icons) is S effort, pure CSS + small click handlers.
- Risk: Jira API rate limits when batch-transitioning many issues. Mitigation: queue mutations with a 200ms delay between calls, show progress, use optimistic UI per existing pattern.

## Competitive Analysis
| Tool | Context menu | Multi-select | Batch actions |
|------|-------------|-------------|---------------|
| Linear | Full context menu on right-click | Cmd+click, Shift+click | Assign, status, priority, label, project |
| Jira Cloud | Limited (in list view only) | Checkbox-based | Transition, assign, edit fields |
| Trello | Card back required for most actions | None | Power-Up dependent |
| Asana | Right-click context menu | Multi-select + toolbar | Assign, move, set dates |
| GitHub Projects | Context menu on cards | None natively | None |

Aegis should match Linear's context menu depth and Jira's batch capability, as Red Hat users are familiar with both.

## Technical Sketch

**New files:**
- `components/board/CardContextMenu.tsx` -- Radix ContextMenu wrapping each card
- `components/board/BatchActionBar.tsx` -- floating bar when multi-select is active
- `components/board/QuickEditOverlay.tsx` -- hover-action icons on cards

**Modified files:**
- `stores/board.ts` -- add `selectedCards: Set<string>`, `toggleCardSelection(key, mode)`, `clearSelection()`, `selectRange(startKey, endKey, columnIssues)` actions
- `components/board/Card.tsx` -- wrap in `<CardContextMenu>`, add selection styling (blue ring/checkbox), add hover overlay
- `components/board/Column.tsx` -- pass selection props to cards
- `components/board/BoardView.tsx` -- render `<BatchActionBar>` when selection is non-empty
- `lib/jira/client.ts` -- add `assignIssue()`, `setPriority()`, `addLabel()` mutation methods (thin wrappers around existing `fetch` to Jira REST)
- `lib/jira/queries.ts` -- add TanStack Query mutations for the new Jira operations

**Approach:**
1. Radix ContextMenu (already available via Shadcn) wraps the card `<div>`.
2. Multi-select state is a `Set<string>` of issue keys in the board store.
3. Batch actions iterate over selected keys, calling mutations sequentially with a shared progress toast.
4. Hover overlay uses CSS `group-hover:opacity-100` on the card container (already uses Tailwind).
