# Proposal: Fix keyboard and screen reader access for interactive elements

## Type: fix

## Source: UAT-3 (Accessibility) C2, C6; UAT-3 U2, U4, U5, U6, U7, U8, U9, U10

## Problem
Multiple interactive elements lack keyboard access and proper ARIA semantics: drag-and-drop has no keyboard alternative, ToolResult collapsible is a div with onClick (not a button), ProviderPicker labels are not associated with inputs, EditorTabs lack tab roles, FileExplorer lacks tree roles, SourceControl lacks aria-expanded, chat messages lack semantic structure, and various inputs/buttons lack accessible labels. These collectively block keyboard-only and screen reader users from core features.

## Solution

1. **Drag-and-drop keyboard alternative (`src/components/board/Card.tsx`, `Column.tsx`)**:
   - Add `aria-roledescription="Draggable item"` to each `Draggable` card
   - Add `aria-label` to each card: `aria-label="${issueKey}: ${summary}"`
   - Add `aria-label` to each `Droppable` column: `aria-label="${statusName} column, ${count} issues"`
   - `@hello-pangea/dnd` provides built-in keyboard DnD (Space to lift, arrows to move) -- these ARIA attributes make it screen-reader comprehensible

2. **ToolResult keyboard access (`src/components/chat/ToolResult.tsx:28-49`)**:
   - Change the `CardHeader` click handler to wrap a `<button>` element
   - Add `aria-expanded={isExpanded}`, `tabIndex={0}`, and keyboard handling

3. **ProviderPicker form labels (`src/components/chat/ProviderPicker.tsx:293-329`)**:
   - Add `id` attributes to each `<Input>` and `htmlFor` to each `<label>`
   - e.g., `<label htmlFor="api-key-input">` / `<Input id="api-key-input" />`

4. **EditorTabs semantics (`src/components/ide/EditorTabs.tsx`)**:
   - Add `role="tablist"` to the container div
   - Add `role="tab"` and `aria-selected={isActive}` to each tab button
   - Add `aria-label="Close ${filename}"` to close buttons (replacing bare `title="Close"`)

5. **FileExplorer tree roles (`src/components/ide/FileExplorer.tsx`)**:
   - Add `role="tree"` to the container, `role="treeitem"` to each node
   - Add `aria-expanded` to directory buttons, `aria-level` for depth

6. **SourceControl panel (`src/components/ide/SourceControl.tsx`)**:
   - Add `aria-expanded={isExpanded}` to the toggle button
   - Add `aria-label="Commit message"` to the commit input

7. **Chat message semantics (`src/components/chat/MessageList.tsx`)**:
   - Add `role="log"` and `aria-live="polite"` to the message container
   - Add `aria-label` to each message indicating sender: `aria-label="${role} message"`

## Effort: M

## Files affected
- `packages/app/src/components/board/Card.tsx` (ARIA for draggable)
- `packages/app/src/components/board/Column.tsx` (ARIA for droppable)
- `packages/app/src/components/chat/ToolResult.tsx` (button + aria-expanded)
- `packages/app/src/components/chat/ProviderPicker.tsx` (label associations)
- `packages/app/src/components/ide/EditorTabs.tsx` (tab roles)
- `packages/app/src/components/ide/FileExplorer.tsx` (tree roles)
- `packages/app/src/components/ide/SourceControl.tsx` (aria-expanded, input label)
- `packages/app/src/components/chat/MessageList.tsx` (log role, live region, message labels)

## Test plan
- Automated: run axe-core on board, chat, and IDE pages -- zero Level A violations
- Screen reader test: navigate board cards with VoiceOver -- hear issue key, summary, and "draggable item"
- Keyboard test: focus ToolResult header, press Enter/Space -- panel expands
- Screen reader test: ProviderPicker form -- labels correctly announced for each input
- Screen reader test: IDE tabs announced as "tab, filename, selected" pattern
- Screen reader test: FileExplorer announced as tree with expand/collapse states
- Screen reader test: new chat message triggers aria-live announcement
