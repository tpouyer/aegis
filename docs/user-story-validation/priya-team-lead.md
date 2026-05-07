# Persona: Priya (Team Lead)

## US-3: Board Viewing & Navigation

### AC-1: Board loads at `/board/1` and shows columns from Jira board configuration
**Pass** — `packages/app/src/routes/board.$boardId.tsx` defines the route via `createFileRoute('/board/$boardId')`, renders `<BoardView boardId={numericBoardId} />`. `BoardView.tsx` calls `useBoard(boardId)` to fetch the board configuration and builds columns from `boardConfig.columnConfig.columns`, mapping each config column (with its name and statuses) into a rendered `<Column>` component.

### AC-2: Issues display key, summary, priority (text + color), assignee avatar
**Pass** — `packages/app/src/components/board/Card.tsx` (`IssueCard`) renders:
- Issue key as `{key}` in a `<span>` (line 59-61)
- Summary as `{fields.summary}` in a `<p>` (line 72-74)
- Priority name as `{fields.priority.name}` with a colored dot via `getPriorityColor()` mapping priority names to Tailwind bg classes (lines 62-68, 167-180)
- Assignee avatar as an `<img>` with `src={fields.assignee.avatarUrls['24x24']}` (lines 97-105)

### AC-3: Sidebar "Board" link navigates to the board
**Pass** — `packages/app/src/components/shared/Sidebar.tsx` renders a `<Link to="/board/$boardId" params={{ boardId: '1' }}>` with the label "Board" and a Kanban icon (lines 19-27).

### AC-4: Keyboard shortcut `g b` navigates to the board
**Pass** — `packages/app/src/routes/__root.tsx` registers a global-scope chord shortcut `'g b'` that calls `navigate({ to: '/board/$boardId', params: { boardId: '1' } })` (lines 39-43). The `ShortcutRegistry` in `packages/app/src/lib/shortcuts/registry.ts` fully supports chord sequences with a 1-second timeout (lines 145-172).

### AC-5: Filter bar allows text search, assignee, component, priority, type filtering
**Pass** — `packages/app/src/components/board/FilterBar.tsx` renders:
- Text search `<Input>` with `data-shortcut-target="filter-bar"` (lines 63-72)
- Assignee dropdown via `<FilterDropdown label="Assignee" ...>` (lines 79-87)
- Component dropdown via `<FilterDropdown label="Component" ...>` (lines 90-98)
- Priority dropdown via `<FilterDropdown label="Priority" ...>` (lines 101-109)
- Type dropdown via `<FilterDropdown label="Type" ...>` (lines 112-119)

All filter values are stored in the Zustand `useBoardStore` via `setFilter()`. The `BoardFilters` type confirms all five filter keys: `assignee`, `component`, `priority`, `text`, `issueType`.

### AC-6: "Clear Filters" button resets all filters
**Partial Pass** — The button exists and calls `clearFilters()` which resets all filters to `null` (board store lines 112-114). However, the button label reads "Clear" (with an X icon), not "Clear Filters" as specified in the AC. It only appears when `hasActiveFilters` is true (FilterBar.tsx lines 123-133). The behavior is correct but the label is slightly abbreviated. Additionally, in the empty-state path when no issues match filters, BoardView renders a separate `EmptyState` with a "Clear Filters" button (BoardView.tsx lines 347-365), which does match the AC text.

### AC-7: Last updated timestamp and Refresh button are visible
**Pass** — `BoardView.tsx` lines 368-396 render a bar with:
- `"Last updated: {lastUpdated}"` timestamp from `dataUpdatedAt` (lines 379-382)
- A `<Button>` labeled "Refresh" with a `<RefreshCw>` icon that calls `refetchIssues()` (lines 383-395). The icon spins (`animate-spin`) while `issuesFetching` is true.

### AC-8: If Jira not connected, shows "Connect to Jira" empty state with action button
**Pass** — `BoardView.tsx` lines 312-329 check `!authManager.isConnected('atlassian')` and render an `<EmptyState variant="auth-required">` with title "Connect to Jira to see your boards", description text, and an action button labeled "Connect to Jira" that navigates to `/settings`.

---

## US-4: Issue Detail & Navigation

### AC-1: Clicking a card opens a slide-over detail panel (Sheet)
**Pass** — `Card.tsx` line 54: clicking the card fires `onClick?.(key)`, which is wired to `handleCardClick` in `BoardView.tsx` (lines 255-258). This sets `selectedIssueKey` and `detailOpen = true`, rendering `<CardDetail issueKey={selectedIssueKey} open={detailOpen} onOpenChange={setDetailOpen} />` (lines 426-430). `CardDetail.tsx` uses `<Sheet>` and `<SheetContent side="right">` from Shadcn/Radix (lines 38-39).

### AC-2: Detail shows: status, priority, type badges; assignee; description (with ADF rendering); linked issues; subtasks; comments
**Pass** — `CardDetail.tsx` renders:
- Status badge: `<Badge>{issue.fields.status.name}</Badge>` (lines 62-66)
- Priority badge: `<Badge variant="outline">{issue.fields.priority.name}</Badge>` (line 67)
- Type badge: `<Badge variant="outline">{issue.fields.issuetype.name}</Badge>` (line 68)
- Assignee: avatar image + display name (lines 91-99)
- Description with ADF rendering via `<DescriptionRenderer content={issue.fields.description} />` which walks the ADF tree to extract text then renders via `<ReactMarkdown>` (lines 129-141, 273-298)
- Linked issues: rendered when `issue.fields.issuelinks` has entries (lines 145-182)
- Subtasks: rendered when `issue.fields.subtasks` has entries (lines 185-217)
- Comments: rendered when `issue.fields.comment.comments` has entries (lines 220-256)

### AC-3: "AI Chat" button navigates to `/issue/{key}/chat`
**Pass** — `CardDetail.tsx` line 75: `<Link to="/issue/$issueKey/chat" params={{ issueKey: issue.key }}>` wrapped in a Button labeled "AI Chat" with a MessageSquare icon.

### AC-4: "Open IDE" button navigates to `/issue/{key}/ide`
**Pass** — `CardDetail.tsx` line 80: `<Link to="/issue/$issueKey/ide" params={{ issueKey: issue.key }}>` wrapped in a Button labeled "Open IDE" with a Code2 icon.

### AC-5: Escape key or clicking outside closes the panel
**Pass** — The `<Sheet>` component from Radix UI/Shadcn handles this natively: clicking the overlay or pressing Escape triggers `onOpenChange(false)`. Additionally, the board route registers an explicit `Escape` shortcut (board.$boardId.tsx lines 63-73) that dispatches `aegis:close-card-detail`, which BoardView listens for and sets `setDetailOpen(false)` (line 289). An `Esc` keyboard hint badge is rendered in the sheet (CardDetail.tsx line 41-42).

### AC-6: Keyboard shortcut `j`/`k` moves focus between cards with visible ring highlight
**Pass** — `board.$boardId.tsx` registers `j` and `k` shortcuts in board scope (lines 22-34) that call `useBoardStore.getState().focusNextCard()` / `focusPrevCard()`. The store (board.ts lines 131-144) increments/decrements `focusedCardIndex` within bounds. `Card.tsx` receives `isFocused` prop and applies `ring-2 ring-primary shadow-md` when focused (line 49), providing a visible ring highlight. The card also gets `tabIndex={isFocused ? 0 : -1}` for proper tab behavior.

### AC-7: `Enter` opens the focused card's detail panel
**Pass** — `board.$boardId.tsx` lines 36-49 register an `Enter` shortcut in board scope with a `when` guard (`focusedCardIndex >= 0`). It dispatches `aegis:open-focused-card`. `BoardView.tsx` lines 280-286 listen for this event, resolve the focused card key from `flatIssueKeys`, and call `handleCardClick`.

---

## US-6 (Partial): Context Panel & Suggested Prompts

### AC-3: After configuring a provider, chat shows suggested prompts
**Pass** — `ChatView.tsx` lines 314-316: when `session.messages.length === 0`, `<ChatEmptyState>` is rendered. This component (lines 346-389) displays four `SUGGESTED_PROMPTS`:
1. "What are the acceptance criteria for this issue?"
2. "Suggest an implementation approach for this issue"
3. "What files in the codebase are most relevant?"
4. "Are there any potential edge cases I should consider?"

Each prompt is a clickable `<button>` that calls `onSend(prompt)` to immediately send the message.

### AC-10: Context panel shows real Jira issue data (or fallback message if Jira not connected)
**Pass** — `issue.$issueKey.chat.tsx` renders `<IssueContextPanel issue={issue ?? null} />` (line 212). When `issue` is `null` (Jira not connected), the panel shows an `AlertCircle` icon and "Connect to Jira to see issue details" (lines 40-54). When connected, the panel renders status/priority/type badges, assignee, creation date, description (with ADF extraction), labels, and components (lines 56-134). The panel is toggled via a chevron button (lines 197-209) and defaults to hidden on mobile (`window.innerWidth >= 768`, line 143).

---

## Defects Found

- **D1**: FilterBar "Clear" button label inconsistent with AC — The FilterBar's clear button (FilterBar.tsx:130) shows "Clear" with an X icon, not "Clear Filters" as specified in US-3 AC-6. The empty-state "Clear Filters" button in BoardView.tsx:358 does match. This is a minor labeling inconsistency; the button in the filter bar could be renamed to "Clear Filters" for consistency with the AC wording.

- **D2**: Context panel fallback message says "Connect to Jira" not "Jira not connected" — The fallback in `IssueContextPanel` (issue.$issueKey.chat.tsx:49) reads "Connect to Jira to see issue details" but has no action button or link to Settings, unlike the board's empty state (BoardView.tsx:319-325 which navigates to `/settings`). A user seeing this fallback in the chat context panel has no direct affordance to connect. This is a minor UX gap: consider adding a "Connect" button linking to Settings.

- **D3**: `focusPrevCard` starts at 0 when no card was focused — When `focusedCardIndex` is `-1` (no card focused) and the user presses `k`, `focusPrevCard` in board.ts (lines 140-143) computes `max(-1 - 1, 0) = 0`, so `k` jumps to the first card. Meanwhile `focusNextCard` checks `focusedCardIndex < totalCardCount - 1` (line 134), so pressing `j` first when `focusedCardIndex === -1` correctly moves to index 0. Both `j` and `k` end up at index 0 on first press, but `k` semantically should go to the last card or do nothing when no card is focused. This is a minor keyboard navigation quirk.
