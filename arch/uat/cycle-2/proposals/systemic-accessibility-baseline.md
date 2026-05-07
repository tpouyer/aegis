# Proposal: Accessibility Baseline -- ARIA Semantics, Keyboard Operability, and Screen Reader Support

## Type: systemic

## Source
- **accessibility C1**: No skip navigation link (WCAG 2.4.1)
- **accessibility C2**: Drag-and-drop has no keyboard alternative (WCAG 2.1.1)
- **accessibility C3**: No page title updates on route changes (WCAG 2.4.2)
- **accessibility C4**: Board and Chat routes have no h1 heading (WCAG 1.3.1, 2.4.6)
- **accessibility C5**: Priority indicator on cards is color-only (WCAG 1.4.1)
- **accessibility C6**: ToolResult collapsible has no keyboard semantics (WCAG 2.1.1, 4.1.2)
- **accessibility C7**: Chat message textarea has no accessible label (WCAG 1.3.1, 4.1.2)
- **accessibility U1**: Sidebar nav has no aria-label (WCAG 1.3.1)
- **accessibility U2**: ProviderPicker form labels not associated with inputs (WCAG 1.3.1, 4.1.2)
- **accessibility U3**: FilterBar search input has no accessible label (WCAG 4.1.2)
- **accessibility U4**: EditorTabs close button has no accessible label (WCAG 4.1.2)
- **accessibility U5**: EditorTabs has no tablist/tab ARIA roles (WCAG 1.3.1, 4.1.2)
- **accessibility U6**: FileExplorer has no ARIA tree semantics (WCAG 1.3.1, 4.1.2)
- **accessibility U7**: SourceControl expand/collapse lacks aria-expanded (WCAG 4.1.2)
- **accessibility U8**: Commit message input lacks accessible label (WCAG 4.1.2)
- **accessibility U9**: MessageList has no live region for new messages (WCAG 4.1.3)
- **accessibility U10**: Chat messages have no role or semantic structure (WCAG 1.3.1)
- **accessibility U11**: MonacoDiffView toggle buttons lack accessible labels (WCAG 4.1.2)
- **accessibility U12**: IDE code/diff toggle buttons lack aria-pressed (WCAG 4.1.2)
- **accessibility P1**: 10px text used extensively for badges
- **accessibility P2**: Loading spinner has no screen reader announcement
- **accessibility P4**: Copy code button only visible on hover, not on focus
- **accessibility P7**: Card container is clickable div with no role="button"
- **accessibility P8**: No focus management on route change
- **power-user U1**: No visual indicator for keyboard-focused card on the board
- **new-contributor P5**: Keyboard shortcuts completely undiscoverable for new users

## Problem
The app has virtually no ARIA semantics on custom interactive elements. Every form input lacks a label association, every collapsible lacks `aria-expanded`, every interactive div lacks `role="button"`, page titles never update, and heading hierarchy is broken on most routes. The board's keyboard navigation (`j`/`k`) tracks a focused card index but never renders a visual focus indicator. This is not individual component oversights -- it is a systematic absence of an accessibility pattern across the entire component library. 22 of 31 accessibility findings map to the same root cause: ARIA attributes are simply never added to custom components.

## Solution
Implement an accessibility baseline across the component library in three passes:

### Pass 1: Structural semantics (route-level)

- **`src/routes/__root.tsx`**: 
  - Add a skip link as the first child of `<body>`: `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to main content</a>`.
  - Add `id="main-content"` to the `<main>` element.
  - Add a `useEffect` that updates `document.title` on route change using TanStack Router's `useMatches()` to build a title like "Board - Aegis" or "PROJ-123 Chat - Aegis".
  - Move focus to `<main>` on route change for screen reader orientation.

- **`src/components/board/BoardView.tsx`**: Add `<h1 className="sr-only">Board: {boardName}</h1>` as the first child.
- **`src/routes/issue.$issueKey.chat.tsx`**: Add `<h1 className="sr-only">Chat: {issueKey}</h1>`.
- **`src/routes/issue.$issueKey.ide.tsx`**: Add `<h1 className="sr-only">IDE: {issueKey}</h1>`.
- **`src/components/shared/Sidebar.tsx`**: Add `aria-label="Main navigation"` to the `<nav>` element.

### Pass 2: Interactive element ARIA (component-level)

- **`src/components/chat/MessageInput.tsx`**: Add `aria-label="Type a message to the AI assistant"` to the `<textarea>`.
- **`src/components/chat/ToolResult.tsx`**: Change `CardHeader` click target to `<button>` with `aria-expanded={isOpen}` and `aria-controls={contentId}`. Add `tabIndex={0}`.
- **`src/components/chat/MessageList.tsx`**: 
  - Add `role="log"` and `aria-label="Chat conversation"` to the message container.
  - Add `aria-live="polite"` to the streaming indicator region.
  - Add `role="listitem"` and `aria-label="Message from {sender}"` to each message.
- **`src/components/chat/ProviderPicker.tsx`**: Add `id` attributes to inputs and `htmlFor` to corresponding labels. Fix three label/input pairs at lines 294, 307, 320.
- **`src/components/board/Card.tsx`**: 
  - Add `role="button"` and `tabIndex={0}` to `CardContainer`, with `onKeyDown` for Enter/Space.
  - Add text labels to priority indicators: replace the color-only dot with a small text badge or add `aria-label` on a `<span role="img">`.
  - Read `focusedCardIndex` from the board store and apply a visible focus ring (`ring-2 ring-primary`) to the currently focused card.
- **`src/components/board/Column.tsx`**: Add `aria-label={statusName}` to the droppable zone. Add keyboard-accessible "Move to..." context menu as a DnD alternative.
- **`src/components/board/FilterBar.tsx`**: Add `aria-label="Search issues"` to the search input.
- **`src/components/ide/EditorTabs.tsx`**: 
  - Add `role="tablist"` to the container div.
  - Add `role="tab"`, `aria-selected={isActive}`, and `aria-label={`${filename}${isDirty ? ' (modified)' : ''}`}` to each tab button.
  - Add `aria-label={`Close ${filename}`}` to each close button.
- **`src/components/ide/FileExplorer.tsx`**: Add `role="tree"` to the container, `role="treeitem"` to each node, `aria-expanded` to directories, and `aria-level` for depth.
- **`src/components/ide/SourceControl.tsx`**: Add `aria-expanded={isExpanded}` to the toggle button. Add `aria-label="Commit message"` to the commit input.
- **`src/components/ide/MonacoDiffView.tsx`**: Add `aria-label` and `aria-pressed` to the side-by-side/inline toggle buttons.
- **`src/components/ide/IDELayout.tsx`**: Add `aria-pressed` to Code/Diff toggle buttons.
- **`src/components/shared/Loading.tsx`**: Add `role="status"` and `aria-live="polite"` to the container.

### Pass 3: Visual accessibility

- **All badge usages**: Replace `text-[10px]` with `text-xs` (12px) across Card.tsx, Column.tsx, ChatView.tsx, ProviderPicker.tsx, FilterBar.tsx, CardDetail.tsx, SourceControl.tsx.
- **`src/components/chat/MessageList.tsx`**: Add `focus-visible:opacity-100` to the copy-code button alongside the existing `group-hover:opacity-100`.
- **`src/components/board/Card.tsx`**: Add text abbreviations next to priority dots (e.g., "H" for High, "C" for Critical) or use distinct shapes/icons per priority level.

## Effort: M

## Files affected
- `packages/app/src/routes/__root.tsx` (skip link, document title, focus management)
- `packages/app/src/components/shared/Sidebar.tsx` (aria-label on nav)
- `packages/app/src/components/shared/Loading.tsx` (role="status")
- `packages/app/src/components/board/BoardView.tsx` (h1, focused card styling)
- `packages/app/src/components/board/Card.tsx` (role, tabIndex, priority labels, focus ring)
- `packages/app/src/components/board/Column.tsx` (aria-label, keyboard move alternative)
- `packages/app/src/components/board/FilterBar.tsx` (aria-label on search)
- `packages/app/src/components/chat/MessageInput.tsx` (aria-label on textarea)
- `packages/app/src/components/chat/MessageList.tsx` (role="log", aria-live, message roles, focus-visible on copy button)
- `packages/app/src/components/chat/ToolResult.tsx` (button semantics, aria-expanded)
- `packages/app/src/components/chat/ProviderPicker.tsx` (htmlFor/id associations)
- `packages/app/src/components/ide/EditorTabs.tsx` (tablist/tab roles, aria-selected, close labels)
- `packages/app/src/components/ide/FileExplorer.tsx` (tree roles, aria-expanded, aria-level)
- `packages/app/src/components/ide/SourceControl.tsx` (aria-expanded, input label)
- `packages/app/src/components/ide/MonacoDiffView.tsx` (aria-label, aria-pressed)
- `packages/app/src/components/ide/IDELayout.tsx` (aria-pressed)
- `packages/app/src/routes/issue.$issueKey.chat.tsx` (h1)
- `packages/app/src/routes/issue.$issueKey.ide.tsx` (h1)

## Test plan
1. **Automated a11y audit**: Run `axe-core` (via `@axe-core/react` in dev mode or `vitest-axe`) on each route. Target zero WCAG 2.1 Level A violations and fewer than 5 Level AA violations.
2. **Screen reader testing**: Test with VoiceOver (macOS) on Safari and Chrome. Verify: skip link works, page title announced on navigation, heading navigation (`H` key) finds h1 on every route, tab key reaches all interactive elements, aria-live regions announce streaming messages.
3. **Keyboard-only testing**: Navigate the entire app using only Tab, Enter, Space, Escape, and arrow keys. Verify every interactive element is reachable and operable. Verify focused card on board has a visible ring. Verify ToolResult can be expanded/collapsed via keyboard.
4. **Color contrast**: Run lighthouse or `axe-core` color contrast check. Verify priority indicators are distinguishable without color.
5. **Unit tests**: Add tests for document title updates (mock `useMatches`), for aria-expanded toggling on collapsibles, and for focus management on route change.
6. **Regression**: Verify existing 305 tests pass after ARIA attribute additions (attributes should not affect rendering logic).
