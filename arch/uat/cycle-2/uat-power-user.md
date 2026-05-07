# UAT: Red Hat Power User -- Cycle 2

## Critical Issues (blocks user journey)

### C1: Escape key in chat does not stop streaming -- event dispatched but never consumed
- **Journey step**: User is on the AI Chat page, a long response is streaming, and presses Escape to stop it
- **Expected**: Streaming should stop immediately (abort the fetch)
- **Actual**: The chat route dispatches `new CustomEvent('aegis:stop-streaming')` at `src/routes/issue.$issueKey.chat.tsx:161`, but no component ever listens for that event. `ChatView.tsx` has a `handleStop` callback (line 216) wired to `abortRef.current?.abort()`, but it is only connected to the stop button's `onClick` (line 301, `<MessageInput onStop={handleStop} ...>`). There is no `addEventListener('aegis:stop-streaming', ...)` anywhere in the codebase.
- **Impact**: All users. The Escape shortcut for stopping generation is completely non-functional. Users must click the stop button with the mouse, which defeats the keyboard-driven workflow.

### C2: Board navigation shortcut (`g b`) uses hardcoded boardId `'1'`, inconsistent with rest of app using `'default'`
- **Journey step**: User presses `g b` chord to navigate to the board from any page
- **Expected**: Navigates to the same board as clicking "Board" in the sidebar
- **Actual**: The `g b` shortcut at `src/routes/__root.tsx:37` navigates to `/board/1` (boardId `'1'`), while the Sidebar (`src/components/shared/Sidebar.tsx:19`), command palette (`src/lib/commands/default-commands.ts:48`), landing page (`src/routes/index.tsx:132`), and issue commands (`src/lib/commands/default-commands.ts:123`) all use boardId `'default'`. This means `g b` loads a different board than every other navigation path.
- **Impact**: All keyboard-power-users. The shortcut either loads the wrong board or produces a `NaN` error if no numeric board exists (the route component casts to `Number(boardId)` at `src/routes/board.$boardId.tsx:13`, and `Number('default')` is `NaN` which is handled, but `Number('1')` loads board 1 specifically).

### C3: Global shortcuts fire twice when a route-specific scope is active
- **Journey step**: User presses `?` to open the shortcut help dialog while on the board page
- **Expected**: The shortcut help dialog opens once
- **Actual**: The root layout calls `useShortcuts('global')` at `src/routes/__root.tsx:21`, and the board route calls `useShortcuts('board')` at `src/routes/board.$boardId.tsx:16`. Both register separate `document.addEventListener('keydown', ...)` handlers. When a key is pressed, both handlers call `shortcutRegistry.handleKeyDown()`. Since the registry matches global shortcuts regardless of the `activeScope` parameter (lines 153, 181, 199 of `registry.ts`), global shortcuts fire from both handlers. The `useShortcuts` hook at `src/lib/shortcuts/use-shortcuts.ts:23` does not check the return value or call `stopImmediatePropagation()`. Result: the `?` shortcut's `setOpen(true)` is called twice; chord shortcuts like `g b` navigate twice.
- **Impact**: All pages with scoped shortcuts (board, chat, IDE). Global shortcuts execute their action function twice per keypress. For `setOpen(true)` this may appear to work (idempotent), but for navigation or toggle actions it causes double execution.

### C4: Provider switch after session exists silently fails -- `createSession` skips if session already exists
- **Journey step**: User opens chat for an issue, starts using Anthropic, then clicks "Change provider..." from the model dropdown, selects OpenAI, and clicks Save
- **Expected**: The chat session should switch to the new provider and model
- **Actual**: `ProviderPicker.onProviderSelected` calls `ChatView.handleProviderSelected` (line 85-93), which calls `createSession(issueKey, providerId, defaultModel)`. But `createSession` at `src/stores/chat.ts:80` has an early return: `if (sessions.has(issueKey)) return;`. Since the session already exists, the provider switch is silently ignored. The `switchProvider` action exists on the store (line 164) but is never called from the UI.
- **Impact**: All users who try to change providers mid-session. The UI appears to accept the change (dialog closes) but the old provider remains active.

### C5: Text filter is applied twice -- once via JQL server-side, once via client-side
- **Journey step**: User types text in the board filter bar to search for issues
- **Expected**: Issues are filtered by text, appearing once in results
- **Actual**: The `buildFilterJql` function in `src/lib/jira/queries.ts:312` adds `text ~ "${filters.text}"` to the JQL query, so the server filters by text. Then `BoardView.tsx:92-103` applies a second client-side text filter using `issue.key.includes()` and `issue.fields.summary.includes()`. The comment says "Apply client-side text filtering (other filters are handled via JQL)" but the JQL builder also includes the text filter. This double-application means: (1) the server does a full-text JQL search (which includes description, comments, etc.), (2) the client then filters the results further with a strict substring match on key+summary only. The client-side filter is more restrictive, so issues that match via description/comment text on the server get filtered out on the client.
- **Impact**: All users. Search results are inconsistent -- a user searching for text that appears in a description but not the summary/key will see "No issues match your filters" even though the JQL returned results.

## UX Issues (confusing or frustrating)

### U1: No visual indicator for keyboard-focused card on the board
- **Journey step**: User presses `j`/`k` to navigate cards on the board via keyboard
- **Expected**: The currently focused card should have a visible highlight/ring/border so the user knows which card is selected before pressing Enter
- **Actual**: The `focusedCardIndex` state is tracked in the board store (`src/stores/board.ts:39`) and `focusNextCard`/`focusPrevCard` update it (lines 131-145). However, neither `Card.tsx`, `Column.tsx`, nor `BoardView.tsx` read the `focusedCardIndex` to apply any visual styling. The `BoardView.tsx` reads it at line 270 but only to sync `totalCardCount` -- it never passes the index to the `Column` or `IssueCard` components. The focused card is invisible to the user.
- **Impact**: All keyboard users. Without visual feedback, pressing `j`/`k` feels broken -- the user has no idea which card is focused and pressing Enter opens an unpredictable card.

### U2: `Cmd+W` in IDE closes browser tab instead of editor tab
- **Journey step**: User has multiple files open in the IDE and presses `Cmd+W` to close the active editor tab
- **Expected**: The active editor tab closes; the browser tab stays open
- **Actual**: The shortcut is registered at `src/routes/issue.$issueKey.ide.tsx:55` with `key: 'mod+w'`. The `ShortcutRegistry.handleKeyDown` calls `event.preventDefault()` on match (line 210 of `registry.ts`). However, `Cmd+W` is a browser-reserved shortcut for closing the tab. The browser processes it before the keydown event reaches JavaScript in most browsers (Chrome, Firefox). The `preventDefault()` call may not work because the browser handles `Cmd+W` at a higher priority level.
- **Impact**: IDE users. Pressing `Cmd+W` closes the entire browser tab, losing unsaved work. Users must use the mouse to click the X on editor tabs.

### U3: PR title is `"PROJ-123: PROJ-123"` -- issue key duplicated, no summary
- **Journey step**: User makes changes in the IDE and clicks "Create PR"
- **Expected**: PR title includes the issue key and a meaningful summary
- **Actual**: `IDELayout.tsx:112` generates the PR title as `` `${issueKey}: ${issueKey}` ``, which produces titles like `"PROJ-123: PROJ-123"`. The issue summary is available (or could be passed through) but is not used. The PR body is equally uninformative: `` `Addresses ${issueKey}` ``.
- **Impact**: All users creating PRs. Reviewers on GitHub see duplicate-key titles with no context about what the PR does.

### U4: Chat issue context panel shows mock data instead of real Jira data
- **Journey step**: User navigates to AI Chat for a real Jira issue and checks the context panel on the right
- **Expected**: The context panel should show the actual issue description, status, assignee, and acceptance criteria from Jira
- **Actual**: The chat route at `src/routes/issue.$issueKey.chat.tsx:171` calls `getMockIssue(issueKey)` which returns hardcoded fake data (generic summary, placeholder description, "dev-user" assignee). The real Jira query hooks (`useIssue`) exist and work for the board's `CardDetail` but are not used in the chat route. The comment at line 16 says "replaced by Jira client in Phase 2" but Phase 2 is listed as complete.
- **Impact**: All chat users. The context panel gives no useful information about the actual issue, making it harder for the AI to receive meaningful context and for the user to reference acceptance criteria.

### U5: Sidebar toggle via command palette uses DOM manipulation, not React state
- **Journey step**: User opens command palette and selects "Toggle Sidebar"
- **Expected**: Sidebar toggles visibility using React state management
- **Actual**: The command at `src/lib/commands/default-commands.ts:86-89` directly manipulates the DOM: `sidebar.classList.toggle('hidden')`. Similarly, "Toggle Theme" at line 76 does `root.classList.toggle('dark')`. The theme toggle in the Header (`src/components/shared/Header.tsx:20-22`) manages its own React state (`isDark`). If the user toggles theme via the command palette, the Header's state goes out of sync -- the icon shows the wrong mode.
- **Impact**: Theme toggle via command palette desynchronizes the Header icon. Sidebar toggle bypasses any React-managed layout state, making it impossible to persist the preference or animate the transition.

### U6: IDE store does not reset when switching between issues
- **Journey step**: User opens IDE for issue PROJ-123, opens several files and modifies them, then navigates back to the board and opens IDE for issue PROJ-456
- **Expected**: IDE opens fresh for issue PROJ-456 with no leftover tabs from PROJ-123
- **Actual**: The IDE store (`src/stores/ide.ts`) has no reset or cleanup function. The `openTabs`, `activeTab`, `commitMessage`, `explorerExpandedPaths`, and `showDiff` states persist across issue transitions. The IDE route at `src/routes/issue.$issueKey.ide.tsx` does not clear the store on mount or when `issueKey` changes. Old tabs from PROJ-123 remain visible even though they reference a different repo/branch context.
- **Impact**: Users who work on multiple issues. Stale tabs from previous issues create confusion, and clicking them loads content from the wrong repo context.

### U7: Board Escape shortcut always fires, even when card detail panel is closed
- **Journey step**: User presses Escape on the board when no card detail panel is open and no card is focused
- **Expected**: Nothing should happen (or at least no unnecessary state changes)
- **Actual**: The Escape shortcut at `src/routes/board.$boardId.tsx:65-70` always dispatches `aegis:close-card-detail` and calls `clearFocus()`, even when `detailOpen` is already false and `focusedCardIndex` is already -1. It lacks a `when` guard, so it unconditionally consumes the Escape key and calls `preventDefault()`, blocking Escape from propagating to other handlers.
- **Impact**: Minor. If the shortcut help dialog is somehow open while the board scope is active, pressing Escape tries to close the nonexistent card detail instead of closing the dialog.

### U8: Theme does not persist across page reloads
- **Journey step**: User toggles to dark mode, then refreshes the page
- **Expected**: The page loads in dark mode
- **Actual**: The Settings page persists theme to `localStorage` (`src/routes/settings.tsx:66`), but the Header component (`src/components/shared/Header.tsx:6-9`) initializes theme only from the current DOM class state, never reading `localStorage`. On page reload, no code reads `aegis_theme` from `localStorage` to apply it. The app always starts in light mode regardless of saved preference.
- **Impact**: All users. Theme preference must be re-set on every page load.

### U9: Context panel toggle button uses `absolute` positioning without a `relative` parent
- **Journey step**: User is on the chat page and the context panel toggle chevron button is positioned at the right edge
- **Expected**: The toggle button should be anchored to the edge between the chat area and the context panel
- **Actual**: The button at `src/routes/issue.$issueKey.chat.tsx:190` uses `className="absolute right-0 top-1/2 ..."` but the parent `<div className="flex h-full">` has no `relative` class. The `absolute` positioning targets the nearest positioned ancestor, which may be the `<main>` or root layout, not the chat area boundary. When the context panel is collapsed, the button may render at an unexpected position.
- **Impact**: Visual glitch. The toggle button may overlap the sidebar or appear misaligned depending on viewport size.

## Polish Items (works but could be better)

### P1: No `Cmd+/` shortcut to focus the chat input
- **Suggestion**: Power users expect a keyboard shortcut to jump focus to the chat input textarea without clicking. Consider registering `mod+/` or `mod+l` in the chat scope that calls `textareaRef.current?.focus()`. The `MessageInput` component already has a `textareaRef` (line 31) but it is not accessible from outside.

### P2: No keyboard shortcut to navigate between Chat and IDE for the same issue
- **Suggestion**: When on `/issue/PROJ-123/chat`, pressing a shortcut like `g i` (or a tab-style `mod+]`) should navigate to `/issue/PROJ-123/ide` and vice versa. Currently the user must use the command palette or browser back button. This could be registered as chat-scope and ide-scope shortcuts.

### P3: Shortcut help modal shows all scopes at once, including inactive ones
- **Suggestion**: `ShortcutHelp.tsx` renders shortcuts for all scopes (global, board, chat, ide) regardless of the current route. For a power user, it would be more useful to highlight the currently active scope or allow filtering. The component at `src/components/shared/ShortcutHelp.tsx:96` calls `shortcutRegistry.getShortcuts()` without any scope awareness.

### P4: IDE file explorer has no keyboard navigation
- **Suggestion**: The file explorer (`src/components/ide/FileExplorer.tsx`) only supports mouse clicks. Power users expect arrow keys to navigate the tree and Enter to open files. Consider adding `tabIndex`, `onKeyDown` handlers, and an `aria-activedescendant` pattern for accessibility compliance.

### P5: No dirty-file warning when navigating away from IDE with unsaved changes
- **Suggestion**: When a user has modified files (tabs with `isDirty: true`) and navigates away from the IDE route, there is no confirmation dialog. The VFS changes are in-memory only and will be lost. Consider using TanStack Router's `beforeLoad` guard or a `beforeunload` listener to warn the user.

### P6: Command palette shows shortcut hints that may not match registered shortcuts
- **Suggestion**: The "Go to Board" command shows `shortcut: '⌘2'` (`src/lib/commands/default-commands.ts:47`), but no such shortcut is actually registered in the shortcut registry. The displayed shortcut hints are hardcoded strings, not derived from the actual shortcut registry. If shortcuts change, the hints become misleading.

### P7: Source control commit input shares state across repos in multi-repo scenario
- **Suggestion**: `SourceControl.tsx` uses a single `commitMessage` from the IDE store (`src/stores/ide.ts:23`), but the change list can be grouped by multiple repos (line 66-71). The same commit message is used for all repos. In a multi-repo issue scenario, the user cannot enter different commit messages per repo.

### P8: Model selector dropdown shows raw model ID instead of display name
- **Suggestion**: In `ChatView.tsx:256`, the model selector button text is `session?.currentModel` which is the model ID (e.g., `claude-sonnet-4-6-20250514`). It should look up the model's `name` property from the provider's `models` array for a friendlier display (e.g., "Claude Sonnet 4.6").

### P9: No IDE tab cycling shortcut (Ctrl+Tab / Cmd+Shift+[ / Cmd+Shift+])
- **Suggestion**: The IDE registers `mod+w` to close the active tab and `mod+s` to save, but there is no keyboard shortcut to cycle between open tabs. Power users working on multiple files expect `Ctrl+Tab` or `Cmd+Shift+[`/`]` to switch between editor tabs without reaching for the mouse.

### P10: `registerIssueCommands` is defined but never called -- command palette has no issue commands
- **Suggestion**: The function `registerIssueCommands` at `src/lib/commands/default-commands.ts:110` would populate the command palette with "Open PROJ-123: Summary" entries, but it is never invoked from any component. The board route or `BoardView` should call it when issues are loaded so users can quickly navigate to specific issues via `Cmd+K`. Additionally, the action navigates to the board page (`boardId: 'default'`) rather than to the issue's chat or detail view, which is misleading given the "Open" label.

### P11: Board store `focusedCardIndex` is not cleared on route unmount
- **Suggestion**: When the user navigates away from the board (e.g., to chat or IDE), the `focusedCardIndex` in the board store remains at its last value. If the user returns to a different board with fewer cards, the stale index could be out of bounds. The board route should call `clearFocus()` in a cleanup effect.

## Positive Observations

- **Keyboard shortcut architecture is excellent**: The scope-based `ShortcutRegistry` with chord sequences, `when` guards, and editable-element suppression is well-designed and thoroughly tested (22 test cases in `registry.test.ts`). The pattern of registering shortcuts in route-level `useEffect` with cleanup is clean.

- **Optimistic update pattern for drag-and-drop is robust**: The `BoardView` correctly applies optimistic updates, fetches available transitions, handles `hasScreen` transitions via the modal, and rolls back on failure. The separation between Zustand (UI state) and TanStack Query (server state) is well-executed.

- **Command palette implementation is polished**: Fuzzy search with multi-word scoring, category grouping, keyboard navigation with arrow keys and Enter, and scroll-into-view behavior all work correctly. The mode prefixes (`>` for files, `/` for actions) are a nice touch.

- **VFS content-addressed caching is smart**: Caching file content by blob SHA means cached content never goes stale -- the same SHA always means the same content. This eliminates an entire class of cache invalidation bugs.

- **Chat session persistence is well-architected**: Sessions persist to IndexedDB with TTL, load lazily on route mount, and the streaming state is correctly excluded from persistence. The export-as-markdown feature (`exportChatAsMarkdown`) is a thoughtful addition for power users.

- **Error boundaries and fallback states are comprehensive**: Monaco has an `ErrorCatcher` boundary, the IDE page handles initialization failures gracefully, and the board shows appropriate auth-required empty states. The `EditorPlaceholder` fallback ensures the IDE is usable even if Monaco fails to load.

- **Transition modal handles edge cases well**: Required field validation, allowed-values dropdowns, loading state during submission, and cancel-rolls-back-optimistic-update are all properly implemented in `TransitionModal.tsx`.

- **Jira query layer is well-structured**: The `jiraKeys` factory pattern for TanStack Query keys, the stale-while-revalidate configuration with appropriate TTLs per data type, and the double-layer cache (IndexedDB + TanStack Query) show careful attention to the rate-limited API constraint.
