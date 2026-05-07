# Persona: Marcus (Red Hat Engineer)

## US-3: Board Viewing & Navigation

### AC-1: Board loads at `/board/1` and shows columns from Jira board configuration
**Pass** -- Route defined at `packages/app/src/routes/board.$boardId.tsx:7` via `createFileRoute('/board/$boardId')`. The `BoardView` component (`:38`) receives `boardId` as a prop, calls `useBoard(boardId)` (`:59-63`) to fetch board config, and builds columns from `boardConfig.columnConfig.columns` at `:82`. Columns are rendered by mapping over the config at `:406-419`.

### AC-2: Issues display key, summary, priority (text + color), assignee avatar
**Pass** -- `IssueCard` in `packages/app/src/components/board/Card.tsx:30-141` renders:
- Key at `:59` (`{key}`)
- Summary at `:72-74`
- Priority color dot at `:63-66` via `getPriorityColor()` (`:167-180`) plus priority text at `:67`
- Assignee avatar at `:97-105` (conditional on `fields.assignee`)

### AC-3: Sidebar "Board" link navigates to the board
**Pass** -- `packages/app/src/components/shared/Sidebar.tsx:19-27` has a `<Link to="/board/$boardId" params={{ boardId: '1' }}>` with label "Board" and a Kanban icon.

### AC-4: Keyboard shortcut `g b` navigates to the board
**Pass** -- `packages/app/src/routes/__root.tsx:39-43` registers a global chord shortcut `g b` via `shortcutRegistry.register({ key: 'g b', scope: 'global', action: () => navigate({ to: '/board/$boardId', params: { boardId: '1' } }) })`. The chord mechanism is implemented in `packages/app/src/lib/shortcuts/registry.ts:145-171`.

### AC-5: Filter bar allows text search, assignee, component, priority, type filtering
**Pass** -- `packages/app/src/components/board/FilterBar.tsx:56-135` renders:
- Text search input at `:63-71`
- Assignee dropdown at `:79-87`
- Component dropdown at `:90-98`
- Priority dropdown at `:100-109`
- Issue type dropdown at `:112-120`
All use the `setFilter` action from the board Zustand store.

### AC-6: "Clear Filters" button resets all filters
**Pass** -- `FilterBar.tsx:123-132` conditionally renders a "Clear" button (with X icon) when `hasActiveFilters` is true. Clicking calls `clearFilters()` from the board store. Note: the button label is "Clear" not "Clear Filters" -- functionally equivalent but text differs from the AC wording. Additionally, the `BoardView.tsx:357-363` shows a "Clear Filters" labeled button in the no-results empty state, which matches the AC wording exactly.

### AC-7: Last updated timestamp and Refresh button are visible
**Pass** -- `BoardView.tsx:378-396` renders a bar with the last-updated timestamp from `dataUpdatedAt` (`:368-370`) and a Refresh button that calls `refetchIssues()` (`:390`). The refresh icon spins while `issuesFetching` is true (`:392`).

### AC-8: If Jira not connected, shows "Connect to Jira" empty state with action button
**Pass** -- `BoardView.tsx:312-329` checks `!authManager.isConnected('atlassian')` on error, and renders an `EmptyState` with `variant="auth-required"`, title "Connect to Jira to see your boards", and an action button labeled "Connect to Jira" that navigates to `/settings`.

---

## US-4: Issue Detail & Navigation

### AC-1: Clicking a card opens a slide-over detail panel (Sheet)
**Pass** -- `IssueCard` in `Card.tsx:54` has `onClick={() => onClick?.(key)}`. `BoardView.tsx:255-258` defines `handleCardClick` which sets `selectedIssueKey` and `detailOpen = true`. `CardDetail.tsx:38` uses `<Sheet open={open} onOpenChange={onOpenChange}>` (Shadcn Sheet) to render the slide-over.

### AC-2: Detail shows: status, priority, type badges; assignee; description (with ADF rendering); linked issues; subtasks; comments
**Pass** -- `CardDetail.tsx` renders all required elements:
- Status badge at `:58-66`
- Priority badge at `:67`
- Type badge at `:68`
- Assignee with avatar at `:89-99`
- Description with ADF rendering at `:129-141` via `DescriptionRenderer` (`:273-280`) which handles both ADF and plain text, rendering through ReactMarkdown
- Linked issues at `:145-182`
- Subtasks at `:185-217`
- Comments at `:220-256`

### AC-3: "AI Chat" button navigates to `/issue/{key}/chat`
**Pass** -- `CardDetail.tsx:74-78` renders a button with `<Link to="/issue/$issueKey/chat" params={{ issueKey: issue.key }}>` and label "AI Chat".

### AC-4: "Open IDE" button navigates to `/issue/{key}/ide`
**Pass** -- `CardDetail.tsx:79-84` renders a button with `<Link to="/issue/$issueKey/ide" params={{ issueKey: issue.key }}>` and label "Open IDE".

### AC-5: Escape key or clicking outside closes the panel
**Pass** -- The Shadcn `Sheet` component (`CardDetail.tsx:38`) inherently supports Escape key and outside-click dismissal via Radix UI's Dialog primitive. The `onOpenChange` prop is wired to `setDetailOpen`. Additionally, `board.$boardId.tsx:63-72` registers an Escape shortcut that dispatches `aegis:close-card-detail`, which `BoardView.tsx:288-289` handles by setting `detailOpen(false)`.

### AC-6: Keyboard shortcut `j`/`k` moves focus between cards with visible ring highlight
**Pass** -- `board.$boardId.tsx:22-33` registers `j` and `k` shortcuts in `board` scope. These call `focusNextCard()` and `focusPrevCard()` from the board store (`stores/board.ts:131-144`). The `IssueCard` component (`Card.tsx:48-49`) applies `ring-2 ring-primary shadow-md` when `isFocused` is true, providing the visible ring highlight. Focus state is tracked via `focusedGlobalIndex` passed from `Column.tsx:54`.

### AC-7: `Enter` opens the focused card's detail panel
**Pass** -- `board.$boardId.tsx:36-49` registers an `Enter` shortcut in `board` scope with a `when` guard that checks `focusedCardIndex >= 0`. It dispatches `aegis:open-focused-card`, which `BoardView.tsx:280-284` listens for and calls `handleCardClick(flatIssueKeys[idx])` to open the detail panel.

---

## US-5: Drag-and-Drop Issue Transition

### AC-1: Dragging a card shows a visual lift effect (shadow, ring)
**Pass** -- `Card.tsx:46-47` applies `shadow-lg ring-2 ring-primary/30` when `snapshot.isDragging` is true via `@hello-pangea/dnd`'s `Draggable` render prop.

### AC-2: Target column highlights when a card hovers over it
**Pass** -- `Column.tsx:42-45` applies `bg-primary/5 ring-1 ring-inset ring-primary/20` when `snapshot.isDraggingOver` is true via the `Droppable` render prop.

### AC-3: Dropping triggers an optimistic UI update (card appears immediately in new column)
**Pass** -- `BoardView.tsx:149-154` calls `applyOptimisticUpdate()` immediately in `handleDragEnd`, before any async operations. The `columns` memo at `:86-91` factors in `optimisticUpdates` by checking `optimistic.targetStatusId` to determine which column an issue appears in.

### AC-4: If the transition requires fields (hasScreen), a modal appears
**Pass** -- `BoardView.tsx:177-183` checks `matchingTransition.hasScreen` and, if true, sets `pendingTransition` and opens the `TransitionModal`. The `TransitionModal` component (`TransitionModal.tsx:49-205`) renders a Dialog with dynamic form fields from `transition.fields`, including selects for fields with `allowedValues` and text inputs otherwise.

### AC-5: On API success, a success toast confirms the transition
**Pass** -- `BoardView.tsx:193-196` calls `toast.success('Issue transitioned', ...)` after `transitionMutation.mutateAsync()` succeeds. Similarly, `BoardView.tsx:234-237` shows a success toast after the TransitionModal submit succeeds.

### AC-6: On API failure, the card returns to its original column with an error toast
**Pass** -- `BoardView.tsx:197-204` catches errors, calls `rollbackOptimisticUpdate(issueKey)` to return the card to its original column, and calls `toast.error('Transition failed', ...)` with the error message.

### AC-7: If no valid transition exists for the target column, an error toast explains why
**Pass** -- `BoardView.tsx:167-174` checks if `matchingTransition` is found. If not, it calls `rollbackOptimisticUpdate(issueKey)` and `toast.error('Transition unavailable', ...)` with a descriptive message including the source status and target column names.

---

## US-7: Web IDE File Editing

### AC-1: IDE loads at `/issue/{key}/ide` and shows the file tree, editor, and source control panel
**Pass** -- Route defined at `packages/app/src/routes/issue.$issueKey.ide.tsx:12` via `createFileRoute('/issue/$issueKey/ide')`. The `IDELayout` component (`packages/app/src/components/ide/IDELayout.tsx:47-315`) renders three panels: FileExplorer (left, `:225-231`), MonacoEditor (center, `:234-282`), and SourceControl (bottom, `:306-312`).

### AC-2: File tree shows the repository structure with expandable directories
**Pass** -- `FileExplorer.tsx:145-176` renders the tree with `role="tree"`. `TreeItem` (`:82-143`) renders each node with expand/collapse for directories via `toggleExplorerPath`. Directory icons toggle between `Folder`/`FolderOpen` with `ChevronRight`/`ChevronDown` indicators (`:97-101`, `:113-121`).

### AC-3: Clicking a file opens it in a tab with syntax highlighting (Monaco editor)
**Pass** -- `TreeItem` (FileExplorer.tsx`:89-95`) calls `openFile(repoKey, node.path)` on click for non-directory nodes. This updates the IDE store (`stores/ide.ts:44-63`). `MonacoEditor.tsx:86-153` renders the Monaco editor with language auto-detection via `getLanguageFromPath()` (`:31-84`) which maps 40+ file extensions to Monaco language identifiers.

### AC-4: Multiple files can be open as tabs simultaneously
**Pass** -- `stores/ide.ts:44-63` manages `openTabs` array. Opening a new file appends to the array unless already open. `EditorTabs.tsx:13-68` renders all open tabs with click-to-switch functionality.

### AC-5: `Cmd+W` closes the active tab
**Pass** -- `issue.$issueKey.ide.tsx:56-62` registers `mod+w` shortcut in `ide` scope that calls `closeTab(activeTab)` from the IDE store. The `closeTab` action (`stores/ide.ts:65-77`) removes the tab and adjusts `activeTab`.

### AC-6: `Cmd+S` is intercepted (prevents browser save dialog)
**Pass** -- `issue.$issueKey.ide.tsx:46-54` registers `mod+s` shortcut in `ide` scope. The action is a no-op (comment: "prevents browser save dialog"). The shortcut registry's `handleKeyDown` calls `event.preventDefault()` at `registry.ts:210` when a shortcut matches, which suppresses the browser's native save dialog.

### AC-7: Code/Diff toggle switches between editor and diff view
**Pass** -- `IDELayout.tsx:166-192` renders Code/Diff toggle buttons that call `toggleDiffView()`. The center panel (`:238-244`) conditionally renders `MonacoDiffView` when `showDiff && diffTarget`, otherwise the regular `MonacoEditor`.

### AC-8: Source control panel shows changed files with A/M/D badges
**Pass** -- `SourceControl.tsx:32-39` defines `statusLabel()` mapping `added`->`A`, `modified`->`M`, `deleted`->`D`. Each change is rendered at `:189-206` with a `Badge` showing the status letter and the file path.

### AC-9: Commit message input and Commit button create a commit
**Pass** -- `SourceControl.tsx:211-227` renders a commit message `Input` and a "Commit" `Button`. The button calls `handleCommit(changeRepoKey)` (`:77-91`) which invokes `onCommit(targetRepoKey, commitMessage)`, wired to `vfs.commit()` in `IDELayout.tsx:107-111`.

### AC-10: Create PR button creates a pull request
**Pass** -- `SourceControl.tsx:228-236` renders a "Create PR" `Button` that calls `handleCreatePR(changeRepoKey)` (`:94-108`), which invokes `onCreatePR(targetRepoKey)`, wired to `vfs.createPR()` in `IDELayout.tsx:114-120`. On success, the PR URL is displayed with a link at `:158-169`.

---

## US-9: Keyboard Navigation & Command Palette

### AC-1: `Cmd+K` opens the command palette
**Pass** -- `__root.tsx:60-67` registers a `keydown` listener that checks for `metaKey || ctrlKey` + `k` and toggles `paletteOpen`. The `CommandPalette` component is rendered at `:94`.

### AC-2: Command palette supports fuzzy search, arrow key navigation, Enter to execute
**Pass** -- `CommandPalette.tsx:125-157` handles `ArrowDown`, `ArrowUp`, `Enter`, and `Escape` keys. The fuzzy search is implemented in `registry.ts:20-53` via `scoreCommand()` which scores against label, description, and keywords with prefix matching weighted higher than substring matching.

### AC-3: `>` prefix filters to file commands; `/` prefix filters to action commands
**Pass** -- `CommandPalette.tsx:73-78`: `>` prefix sets `categoryFilter = 'file'`; `/` prefix sets `categoryFilter = 'action'`. Results are then filtered at `:89-91`.

### AC-4: `g b` chord navigates to the board
**Pass** -- Covered in US-3 AC-4. `__root.tsx:39-43` registers the `g b` chord with `scope: 'global'`.

### AC-5: `g s` chord navigates to settings
**Pass** -- `__root.tsx:45-48` registers `g s` chord: `shortcutRegistry.register({ key: 'g s', scope: 'global', action: () => navigate({ to: '/settings' }) })`.

### AC-6: `j`/`k` moves focus between board cards with visible focus ring
**Pass** -- Covered in US-4 AC-6. Shortcuts registered in `board.$boardId.tsx:22-33`, focus ring applied in `Card.tsx:48-49`.

### AC-7: `f` focuses the filter bar search input
**Pass** -- `board.$boardId.tsx:51-60` registers `f` shortcut in `board` scope that queries `[data-shortcut-target="filter-bar"]` and calls `.focus()`. The `FilterBar.tsx:71` sets `data-shortcut-target="filter-bar"` on the search input.

### AC-8: `Enter` opens the focused card's detail panel
**Pass** -- Covered in US-4 AC-7. Registered in `board.$boardId.tsx:36-49`.

### AC-9: `Escape` closes the card detail / clears focus / stops streaming (context-dependent)
**Pass** -- Board scope: `board.$boardId.tsx:63-72` registers Escape to dispatch `aegis:close-card-detail` and call `clearFocus()`. IDE scope: `issue.$issueKey.ide.tsx:68-79` registers Escape to close diff view (with `when` guard). The Shadcn Sheet and Dialog components also natively handle Escape via Radix primitives.

### AC-10: `?` shows shortcut help overlay
**Pass** -- `ShortcutHelp.tsx:81-88` registers `?` as a global shortcut that sets `open(true)`. The component renders a `Dialog` listing all shortcuts grouped by scope (`:96-148`), with platform-aware key formatting via `formatKey()` (`:37-46`).

---

## US-13: Token Expiry & Re-authentication

### AC-1: On app startup, expired token metadata is cleaned from localStorage
**Pass** -- `__root.tsx:25-27` calls `authManager.clearExpiredTokens()` in a `useEffect` on mount. `AuthManager.clearExpiredTokens()` at `manager.ts:193-219` (async version) and `:266-283` (sync version) iterate over stored tokens, delete expired ones, update the auth level, and call `persistTokenMetadata()` which writes back to localStorage. The sync version at `:266` is the one actually called since the root layout effect doesn't await it.

### AC-2: When the Service Worker detects an expired token, it doesn't inject it
**Pass** -- `public/sw.js:165-179` in `handleApiRequest()`: checks `isTokenExpired(token)` at `:173`. If expired, deletes the token from the Map (`:175`), calls `notifyClientsTokenExpired(provider)` (`:176`), and lets the request proceed unauthenticated (`:179`) so the caller receives a 401.

### AC-3: When a Jira/GitHub API returns 401, the token is cleared and the auth-required empty state is shown
**Pass** -- Jira client: `packages/app/src/lib/jira/client.ts:67-69` checks `response.status === 401` and calls `authManager.disconnect('atlassian')`. GitHub client: `packages/app/src/lib/github/client.ts:49-51` checks `response.status === 401` and calls `authManager.disconnect('github')`. After disconnect, the board's error path at `BoardView.tsx:312-329` checks `!authManager.isConnected('atlassian')` and renders the "Connect to Jira" empty state.

### AC-4: The "Connect to Jira" / "Connect to GitHub" empty states link to Settings
**Pass** -- Board view: `BoardView.tsx:322-325` renders action button "Connect to Jira" that navigates to `/settings`. IDE view: `IDELayout.tsx:259-269` renders "Connect to GitHub" empty state with action navigating to `/settings`. Both use the `EmptyState` component with `variant="auth-required"`.

---

## Defects Found

- **D1**: Duplicate `clearExpiredTokens` method in AuthManager -- `packages/app/src/lib/auth/manager.ts:193` defines `async clearExpiredTokens(): Promise<void>` and `:266` defines `clearExpiredTokens(): void` (non-async). The second method declaration shadows the first at runtime (last definition wins in a class body). The async version (which also clears tokens from the SW) is unreachable. The root layout at `__root.tsx:26` calls it without `await`, so the sync version works, but the async version with its SW cleanup logic is dead code. TypeScript should flag this as a duplicate method name, but if `noEmit` is the only check, it may be silently ignored depending on tsconfig strictness.

- **D2**: FilterBar "Clear" button label mismatch -- `packages/app/src/components/board/FilterBar.tsx:131` labels the button "Clear" (not "Clear Filters" as stated in US-3 AC-6). The empty-state version at `BoardView.tsx:360` does say "Clear Filters". This is a minor cosmetic inconsistency; functionality is correct.

- **D3**: IDE file explorer missing `role="tree"` on the outer container for proper nesting -- `FileExplorer.tsx:159` has `role="tree"` on the root div, which is correct. However, `TreeItem` at `:104` uses `role="treeitem"` but its children group at `:130` uses `role="group"` instead of nesting under a `role="tree"`. This is actually correct per WAI-ARIA treeview pattern (`group` is the recommended role for nested items within a treeitem), so this is not a defect. (Retracted.)

- **D3** (revised): IDE file explorer/AI panel default visibility on desktop -- `IDELayout.tsx:69` initializes `explorerVisible` to `false`. On desktop (lg+ breakpoints), the CSS class `lg:block` (`:229`) ensures the explorer is always visible regardless of state, which is correct. No defect.

- **D3** (final): Command palette "Toggle Sidebar" action is fragile -- `default-commands.ts:88-89` implements sidebar toggle by directly manipulating the DOM (`document.querySelector('aside')?.classList.toggle('hidden')`) instead of using the `useSidebarStore` toggle. This bypasses the Zustand store and can lead to desynchronized state between the store's `sidebarOpen` flag and the actual DOM. This is a minor implementation concern but does not directly violate any of the assigned acceptance criteria.
