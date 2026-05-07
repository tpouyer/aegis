# Proposal: Fix board navigation to use consistent board ID handling

## Type: fix

## Source: UAT-1 (New Contributor) C4, C5; UAT-2 (Power User) C2

## Problem
Board navigation is broken in two ways: (1) The sidebar, landing page, and command palette all link to `boardId: 'default'`, which the board route converts to `NaN` via `Number(boardId)`, producing a confusing "Invalid board ID: default" error. (2) The `g b` keyboard shortcut uses a different `boardId: '1'`, creating inconsistent behavior. Flagged by both the New Contributor and Power User UAT reports.

## Solution

1. **Board route (`src/routes/board.$boardId.tsx`)**: Instead of `Number(boardId)` at line 13, handle the `'default'` case explicitly:
   - If `boardId === 'default'`, check if the user has an Atlassian connection and a configured default board. If yes, use that board's numeric ID. If no, show a "Connect to Jira to load your board" empty state (reusing the existing auth-required `EmptyState`), or a board selector if connected but no default is set.
   - If `boardId` is numeric, proceed as current.
   - Remove the `NaN` error path or make it show a user-friendly "Board not found" with navigation back to settings.

2. **Root route (`src/routes/__root.tsx`)**: Change the `g b` shortcut at line 37 from `boardId: '1'` to `boardId: 'default'` to match all other navigation paths.

3. **Consider a board selection flow**: If the user has Jira connected but no default board configured, show a board picker (list of Jira boards from the API) rather than a dead end. This could be a simple dropdown in the auth-required empty state.

## Effort: S

## Files affected
- `packages/app/src/routes/board.$boardId.tsx` (handle 'default' boardId gracefully)
- `packages/app/src/routes/__root.tsx` (fix `g b` shortcut to use `'default'`)

## Test plan
- Unit test: board route with `boardId='default'` shows auth-required empty state (not NaN error)
- Unit test: board route with `boardId='42'` proceeds to numeric board loading
- Unit test: verify `g b` shortcut navigates to `/board/default`
- Manual test: click "Board" in sidebar, verify no NaN error
- Manual test: press `g b`, verify same destination as sidebar click
- Manual test: navigate to `/board/default` without Jira auth, verify friendly empty state with "Connect to Jira" CTA
