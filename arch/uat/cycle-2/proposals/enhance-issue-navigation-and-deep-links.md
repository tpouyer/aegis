# Proposal: Issue Navigation, Deep Links, and Recent Activity

## Type: enhancement

## Source
**UAT findings addressed:**
- New Contributor U6: Chat and IDE pages accessible via direct URL only -- no navigation path from board cards
- New Contributor P4: PR title uses redundant pattern `${issueKey}: ${issueKey}` -- no summary
- Power User U3: PR title is `"PROJ-123: PROJ-123"` -- issue key duplicated, no summary
- Power User P2: No keyboard shortcut to navigate between Chat and IDE for the same issue
- Power User P3: Shortcut help modal shows all scopes at once, including inactive ones
- Power User P6: Command palette shows shortcut hints that do not match registered shortcuts
- Power User P7: Source control commit input shares state across repos in multi-repo scenario
- Power User P8: Model selector shows raw model ID instead of display name
- New Contributor C4: Board navigates to boardId 'default' which resolves to NaN
- New Contributor C5: Keyboard shortcut `g b` navigates to boardId '1' -- inconsistent with rest of app
- Power User C2: Board navigation shortcut `g b` uses hardcoded boardId '1', inconsistent with rest of app using 'default'

**Cycle 1 features addressed:**
- **growth-shareable-deep-links** (5/5 approved): Board filter persistence in URL, chat message anchors, IDE file+line deep links, auth-gated fallback with redirect preservation
- **power-recent-activity** (5/5 approved): Recent issues in sidebar, quick-switch shortcut (Ctrl+Tab), activity indicator dots

## Problem
The core user journey of "see issue on board, discuss with AI, edit code" is broken because board cards have no links to chat or IDE views. Users can only reach `/issue/:key/chat` or `/issue/:key/ide` by manually typing URLs. Board navigation is also broken: the sidebar, landing page, and command palette use boardId `'default'` (which resolves to NaN), while `g b` uses boardId `'1'`, creating two different error states for the same action. PR titles duplicate the issue key with no summary. There is no recent-issues sidebar, no quick-switch between issues, no filter persistence in URLs, and no way to share deep links to specific board states, chat messages, or IDE files.

## Solution

### 1. Board card navigation links
- In `CardDetail.tsx`, add "Open Chat" and "Open IDE" buttons that link to `/issue/${issueKey}/chat` and `/issue/${issueKey}/ide` using TanStack Router `<Link>` components.
- In `Card.tsx`, verify the existing "AI Chat" and "Open IDE" buttons (lines 106-129) actually navigate correctly. These buttons exist but their navigation targets should be confirmed.
- Add the issue key to the sidebar when a user is on an issue route, showing contextual "Chat" and "IDE" tabs.

### 2. Fix board ID routing
- In `board.$boardId.tsx`, handle `boardId === 'default'` as a special case: show a board selection UI or redirect to the settings-configured default board. Do not attempt `Number('default')`.
- In `__root.tsx`, change the `g b` shortcut to use `boardId: 'default'` to match all other navigation paths.
- Long-term: store the user's preferred board ID in localStorage and use it as the default. If no preference is set, show the board empty state with instructions to configure a Jira board in Settings.

### 3. Recent issues sidebar section
- Create `src/stores/activity.ts` with `recentIssues: Array<{ issueKey, summary, lastView, lastVisited }>`, persisted in localStorage, capped at 20 entries.
- In `Sidebar.tsx`, add a "Recent" section below the main navigation showing the last 8 issues with icons indicating the last view used (chat or IDE).
- In each issue route (`issue.$issueKey.chat.tsx`, `issue.$issueKey.ide.tsx`), record visits via `useEffect` on mount.

### 4. Chat/IDE quick-switch shortcuts
- Register `g i` (go to IDE) in the chat scope and `g c` (go to chat) in the IDE scope, navigating between `/issue/${issueKey}/chat` and `/issue/${issueKey}/ide` for the current issue.
- In `ShortcutHelp.tsx`, filter displayed shortcuts to show only the current route's active scope first, with other scopes collapsed/dimmed. Derive shortcut hints in the command palette from the actual shortcut registry instead of hardcoded strings.

### 5. Board filter URL persistence
- In `board.$boardId.tsx`, read filter state from URL search params on mount (`?assignee=...&component=...&text=...`).
- In `FilterBar.tsx`, on filter change, call `router.navigate({ search: serializeFilters() })` to update the URL without page reload.
- This makes board filter states bookmarkable and shareable.

### 6. IDE file + line deep links
- In `issue.$issueKey.ide.tsx`, read `file` and `line` search params. Pass as initial state to IDELayout, which auto-opens the specified file and scrolls Monaco to the given line.

### 7. Fix PR title
- In `IDELayout.tsx:112`, change PR title from `` `${issueKey}: ${issueKey}` `` to `` `${issueKey}: ${issueSummary || 'Implementation'}` ``. Pass the issue summary through from the parent route or the activity store.

## Effort: M

## Files affected
- `src/stores/activity.ts` (new -- recent issues tracking)
- `src/components/shared/Sidebar.tsx` (recent issues section)
- `src/components/board/CardDetail.tsx` (add Chat/IDE navigation links)
- `src/routes/board.$boardId.tsx` (fix 'default' boardId handling, read URL filters)
- `src/routes/__root.tsx` (fix `g b` shortcut to use 'default')
- `src/routes/issue.$issueKey.chat.tsx` (record visit, register `g i` shortcut)
- `src/routes/issue.$issueKey.ide.tsx` (record visit, register `g c` shortcut, read file/line params)
- `src/components/board/FilterBar.tsx` (URL-based filter persistence)
- `src/stores/board.ts` (serializeFilters, accept initial filters from URL)
- `src/components/ide/IDELayout.tsx` (fix PR title, accept initial file/line)
- `src/components/shared/ShortcutHelp.tsx` (scope-aware filtering)
- `src/lib/commands/default-commands.ts` (derive shortcut hints from registry)

## Test plan
- Verify board CardDetail shows "Open Chat" and "Open IDE" buttons that navigate correctly via client-side routing
- Verify navigating to `/board/default` shows a usable state (board selection or empty state) instead of "Invalid board ID: default"
- Verify `g b` shortcut navigates to the same board as the sidebar "Board" link
- Verify recent issues appear in sidebar after visiting `/issue/AAP-123/chat` and `/issue/AAP-456/ide`
- Verify `g i` from chat navigates to IDE for the same issue, and `g c` from IDE navigates to chat
- Verify board URL updates when filters change (e.g., `/board/42?text=search&assignee=tpouyer`)
- Verify opening a shared board URL restores the filter state
- Verify IDE deep link `/issue/AAP-123/ide?file=src/main.py&line=42` opens the file and scrolls to line 42
- Verify PR title uses issue summary instead of duplicating the issue key
- Verify ShortcutHelp shows active scope shortcuts prominently
