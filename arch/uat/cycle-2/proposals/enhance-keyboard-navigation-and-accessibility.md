# Proposal: Keyboard Navigation and Accessibility Hardening

## Type: enhancement

## Source
**UAT findings addressed:**
- Accessibility C1: No skip navigation link (WCAG 2.4.1)
- Accessibility C2: Drag-and-drop has no keyboard alternative (WCAG 2.1.1)
- Accessibility C3: No page title updates on route changes (WCAG 2.4.2)
- Accessibility C4: Board and Chat routes have no h1 heading (WCAG 1.3.1)
- Accessibility C5: Priority indicator on cards is color-only (WCAG 1.4.1)
- Accessibility C6: ToolResult collapsible has no keyboard semantics (WCAG 2.1.1)
- Accessibility C7: Chat message textarea has no accessible label (WCAG 1.3.1)
- Accessibility U1: Sidebar nav has no aria-label
- Accessibility U3: Filter bar search input has no accessible label
- Accessibility U6: FileExplorer tree has no ARIA tree semantics
- Accessibility U9: MessageList has no live region for new messages
- Accessibility U10: Chat message bubbles have no role or semantic structure
- Accessibility P1: text-[10px] badges too small for low vision users
- Accessibility P2: Loading spinner has no screen reader announcement
- Accessibility P4: Copy code button not visible on keyboard focus
- Accessibility P7: Card container is clickable but announced as generic
- Accessibility P8: Focus management on route change
- Power User U1: No visual indicator for keyboard-focused card on the board
- Power User P4: IDE file explorer has no keyboard navigation
- Power User U6: Board Escape shortcut always fires even when card detail panel is closed
- New Contributor P5: Missing visual indication of keyboard shortcuts for new users
- New Contributor P8: Command palette sidebar toggle uses brittle DOM query

**Cycle 1 features addressed:**
- **power-quick-issue-actions** (5/5 approved): The card context menu (Part 1) provides an accessible keyboard alternative to drag-and-drop via "Transition to" submenu, directly solving Accessibility C2
- **power-ide-file-search** (5/5 approved): IDE file explorer keyboard navigation (arrow keys, Enter) is a prerequisite for the file finder, and ARIA tree semantics make the explorer screen-reader compatible

## Problem
The app has 7 critical WCAG Level A violations and numerous Level AA issues. Keyboard-only users cannot: skip navigation, move cards between columns, expand tool results in chat, or navigate the IDE file tree. Screen reader users get no page titles, no heading hierarchy, no landmark labels, no live regions for streaming content, and color-only priority indicators. The board's `j/k` keyboard navigation tracks focused card index but never renders a visual indicator, making it invisible. These gaps block adoption by keyboard-power-users and assistive technology users alike.

## Solution

### 1. Skip navigation and page structure
- Add a visually-hidden "Skip to main content" link as the first child of `<body>` in `__root.tsx`. Add `id="main-content"` to `<main>`.
- Add `aria-label="Main navigation"` to the `<nav>` in `Sidebar.tsx`.
- Add dynamic `document.title` updates via a `useEffect` in `__root.tsx` that reads the current route and sets the title (e.g., "Board - Aegis", "AAP-1234 Chat - Aegis").
- Add `<h1>` headings to BoardView ("Board"), ChatView ("Chat: {issueKey}"), and IDELayout ("IDE: {issueKey}") -- visually styled as appropriate or `sr-only` if design requires.
- On route change, move focus to `<main>` or the `<h1>` so screen readers announce the new page.

### 2. Board card keyboard focus indicator
- In `BoardView.tsx` or `Column.tsx`, pass `focusedCardIndex` down to cards. In `Card.tsx`, apply a visible focus ring (`ring-2 ring-primary`) when the card's index matches `focusedCardIndex`. This makes `j/k` navigation visible.
- Fix the Escape shortcut in `board.$boardId.tsx` to only fire when `detailOpen` is true or `focusedCardIndex >= 0`, preventing it from swallowing Escape from other handlers.

### 3. Card context menu as keyboard-accessible DnD alternative
- Wrap each `IssueCard` in a Radix `ContextMenu` (from Shadcn). Include "Transition to > [status list]" as a submenu. This provides a keyboard path to move cards between columns without drag-and-drop, satisfying WCAG 2.1.1.
- Add `role="button"`, `tabIndex={0}`, and `onKeyDown` (Enter/Space) to the card container for interactive semantics.
- Add `aria-roledescription="Draggable issue card"` and `aria-label="{issueKey}: {summary}"` to each card for screen reader context.

### 4. Priority indicator with text + icon
- Replace the 2x2px color dot in `Card.tsx` with a small icon (arrow-up, arrow-down, dash) plus `aria-label="Priority: {name}"`. Use both color and shape to differentiate. Increase the indicator size from `h-2 w-2` to `h-3 w-3` minimum.

### 5. Chat accessibility
- Add `aria-label="Message to AI assistant"` to the textarea in `MessageInput.tsx`.
- Wrap the message list in a `role="log"` container with `aria-live="polite"` and `aria-label="Chat conversation"`.
- Add `role="group"` and `aria-label="Message from {sender}"` to each message bubble.
- Make `ToolResult` header a `<button>` with `aria-expanded`, `tabIndex={0}`, and keyboard Enter/Space handling.

### 6. IDE file explorer ARIA tree
- Add `role="tree"` to the file explorer container, `role="treeitem"` to each node, `aria-expanded` to directories, and `aria-level` for depth.
- Add arrow key navigation: Up/Down to move between visible nodes, Left to collapse or move to parent, Right to expand or move to first child, Enter to open file.
- Add `aria-label="File explorer"` to the container.

### 7. Form label associations
- Add `aria-label` to `FilterBar.tsx` search input ("Search issues").
- Associate labels with inputs in `ProviderPicker.tsx` via `htmlFor`/`id` pairs.
- Add `aria-label` to editor tab close buttons ("Close {filename}") and source control commit input ("Commit message").

### 8. Minor accessibility fixes
- Replace `text-[10px]` with `text-xs` (12px) across all badge instances.
- Add `role="status"` and `aria-live="polite"` to the Loading component.
- Add `focus-visible:opacity-100` to the copy-code button in MessageList.
- Add a visible "Keyboard shortcuts" link in the sidebar footer or Settings page for discoverability.

## Effort: L

## Files affected
- `src/routes/__root.tsx` (skip link, page title, focus management on route change)
- `src/components/shared/Sidebar.tsx` (aria-label on nav, keyboard shortcuts hint link)
- `src/components/board/BoardView.tsx` (pass focusedCardIndex to columns)
- `src/components/board/Column.tsx` (pass focusedCardIndex to cards, aria-label on droppable)
- `src/components/board/Card.tsx` (focus ring, role="button", tabIndex, aria-label, priority icon, context menu wrapper)
- `src/components/board/CardContextMenu.tsx` (new -- Radix ContextMenu with transition submenu)
- `src/components/board/FilterBar.tsx` (aria-label on search input)
- `src/components/chat/MessageInput.tsx` (aria-label on textarea)
- `src/components/chat/MessageList.tsx` (role="log", aria-live, message sender labels, copy button focus)
- `src/components/chat/ToolResult.tsx` (button semantics, aria-expanded)
- `src/components/chat/ProviderPicker.tsx` (htmlFor/id on labels/inputs)
- `src/components/ide/FileExplorer.tsx` (ARIA tree roles, keyboard navigation)
- `src/components/ide/EditorTabs.tsx` (aria-label on close buttons, role="tablist"/role="tab")
- `src/components/ide/SourceControl.tsx` (aria-label on commit input, aria-expanded on toggle)
- `src/components/shared/Loading.tsx` (role="status", aria-live)
- `src/routes/board.$boardId.tsx` (fix Escape shortcut guard)

## Test plan
- Automated axe-core scan on each route: verify zero Level A violations
- Manual screen reader test (VoiceOver on macOS): navigate all routes using only keyboard, verify page titles announced, h1 headings found, skip link works
- Keyboard-only test: verify `j/k` navigation shows visible focus ring on cards, Enter opens card detail, context menu opens with Shift+F10 or Space
- Verify card context menu "Transition to" submenu moves a card between columns (keyboard-only, no drag)
- Verify priority indicators are distinguishable without color (turn on grayscale mode in OS accessibility settings)
- Verify chat textarea is announced as "Message to AI assistant" by screen reader
- Verify streaming messages are announced via aria-live region
- Verify ToolResult can be expanded/collapsed with Enter/Space
- Verify file explorer navigable with arrow keys, expanded/collapsed with Left/Right
- Visual regression test: confirm text-[10px] replaced with text-xs does not break layouts
- Verify focus moves to main content on route navigation
