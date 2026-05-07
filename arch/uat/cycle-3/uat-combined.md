# UAT: Combined Findings — Cycle 3

Post-fix re-assessment after Cycle 2's 9 implemented fixes. Focuses on remaining issues, regressions, and newly-discovered problems.

## Cycle 2 Fix Verification

| Fix | Status | Notes |
|-----|--------|-------|
| fix-sidebar-board-navigation | ✅ Verified | Sidebar, landing, palette all use boardId `1` now |
| fix-escape-stop-streaming | ✅ Verified | Event listener added in ChatView |
| fix-provider-switch | ✅ Verified | Uses switchProvider/switchModel when session exists |
| fix-card-focus-indicator | ✅ Verified | Ring highlight + aria-selected on focused card |
| fix-chat-textarea-label | ✅ Verified | aria-label added |
| fix-priority-indicator | ✅ Verified | Text + color dot now shown |
| fix-abort-signal-providers | ✅ Verified | signal passed to all 3 providers, this.endpoint fixed |
| fix-skip-nav-headings | ✅ Verified | Skip link, page titles, main ID added |
| fix-theme-state-consolidation | ✅ Verified | Single Zustand store, all 3 consumers updated |

## Critical Issues (blocks user journey)

### C1: Auth connect buttons still non-functional (PERSISTS from Cycle 2)
- **Journey step**: User clicks any "Connect" button on landing or settings
- **Expected**: OAuth flow initiates
- **Actual**: Still console.info only (`src/routes/index.tsx:109-115`, `src/routes/settings.tsx:77-80`)
- **Impact**: Complete blocker. Zero users can authenticate. This is the #1 remaining issue.

### C2: No OAuth callback route (PERSISTS from Cycle 2)
- **Journey step**: OAuth provider redirects back after user authorizes
- **Expected**: Callback route handles code exchange
- **Actual**: No `/auth/callback` route exists. OAuth functions in `src/lib/auth/*.ts` are never called.
- **Impact**: Even if C1 were fixed, auth flow can't complete.

### C3: Token refresh unimplemented (PERSISTS from Cycle 2)
- **Journey step**: Token expires after ~1 hour
- **Expected**: Silent refresh
- **Actual**: `AuthManager.refreshToken()` always throws (`src/lib/auth/manager.ts:137-139`)
- **Impact**: All authenticated users lose access after token expiry.

## UX Issues (confusing or frustrating)

### U1: ToolResult collapsible header is a div, not a button — no keyboard access
- **Journey step**: Keyboard user tries to expand/collapse a tool call result in chat
- **Expected**: Tab to the header, press Enter/Space to toggle
- **Actual**: `CardHeader` with `onClick` but no `tabIndex`, `role="button"`, or keyboard handler (`src/components/chat/ToolResult.tsx:29-31`)
- **Impact**: Keyboard users can't interact with tool results.

### U2: EditorTabs lacks tab role semantics
- **Journey step**: Screen reader user navigates IDE tabs
- **Expected**: Announced as tab list with tab roles
- **Actual**: Container is a plain `div`, tabs are `div > button` without `role="tab"`, `role="tablist"`, or `aria-selected` (`src/components/ide/EditorTabs.tsx:20-63`)
- **Impact**: Screen readers don't announce tab navigation.

### U3: FileExplorer lacks tree role semantics
- **Journey step**: Screen reader user navigates file tree
- **Expected**: Announced as tree with expandable items
- **Actual**: No `role="tree"`, `role="treeitem"`, `aria-expanded` attributes. Buttons are used correctly but lack tree semantics (`src/components/ide/FileExplorer.tsx:103-141`)
- **Impact**: Screen readers don't convey the tree structure.

### U4: CardDetail sheet has no navigation links to Chat or IDE
- **Journey step**: User opens card detail for an issue, wants to discuss it with AI or edit code
- **Expected**: Links to `/issue/{key}/chat` and `/issue/{key}/ide` in the detail panel
- **Actual**: CardDetail shows issue info but no action links (`src/components/board/CardDetail.tsx`). The only Chat/IDE links are in the small card footer buttons.
- **Impact**: Users must close the detail panel and find the tiny footer buttons to navigate.

### U5: Command palette sidebar toggle uses DOM manipulation
- **Journey step**: User runs "Toggle Sidebar" from Cmd+K
- **Expected**: Sidebar toggles via React state
- **Actual**: Uses `document.querySelector('aside')?.classList.toggle('hidden')` (`src/lib/commands/default-commands.ts:87-89`), bypassing React. If any component re-renders, the DOM change is lost.
- **Impact**: Sidebar toggle is fragile and doesn't persist.

### U6: Chat context panel uses mock Jira data (PERSISTS from Cycle 2)
- **Journey step**: User opens chat for an issue
- **Expected**: Real issue data
- **Actual**: `getMockIssue()` returns fake data (`src/routes/issue.$issueKey.chat.tsx:31-52`)
- **Impact**: AI gets fabricated context, context panel is misleading.

## Polish Items (works but could be better)

### P1: ProviderPicker casts LLM provider IDs as AuthProvider type
- **Suggestion**: `sendTokenToSW(selected.id as 'github', ...)` at `src/components/chat/ProviderPicker.tsx:202` is a type safety issue. LLM provider IDs aren't AuthProvider values.

### P2: Close button on EditorTabs has no aria-label
- **Suggestion**: The X button at `src/components/ide/EditorTabs.tsx:47-56` has `title="Close"` but no `aria-label`. Screen readers may not announce the title.

### P3: Sidebar nav links still lack aria-current
- **Suggestion**: Active sidebar link needs `aria-current="page"` (`src/components/shared/Sidebar.tsx`)

### P4: Board column h3 headings should be h2
- **Suggestion**: Column headers use h3 without parent h2 (`src/components/board/Column.tsx:27`)

## Positive Observations
- All 9 Cycle 2 fixes verified working correctly
- No regressions detected — 305 tests still pass
- Theme now syncs across Header, Settings, and Command Palette
- Card focus ring is clearly visible during j/k navigation
- Priority text labels provide non-color information
- Skip nav link works correctly for keyboard users
- Page titles update on every route change
