# Persona: Jordan (Accessibility)

## US-10: Accessible Screen Reader Experience

### AC-1: [Pass] Skip navigation link — first focusable element on every page

**Evidence:** `packages/app/src/routes/__root.tsx:82-83`

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-4 focus:text-foreground focus:shadow-lg">
  Skip to main content
</a>
```

The skip link is the very first child inside the root layout `<div>`, rendered before `<Header />` and `<Sidebar />`. It targets `#main-content` which is on the `<main>` element at line 88. The `sr-only` class hides it visually but keeps it in tab order; `focus:not-sr-only` reveals it on focus. Since `__root.tsx` wraps all routes via `<Outlet />`, this applies to every page.

**Verdict:** Correctly implemented.

---

### AC-2: [Pass] Page titles update on route changes

**Evidence:**

| Route | File:Line | Title Set |
|---|---|---|
| `/` (Home) | `routes/index.tsx:211` | `Aegis -- Home` |
| `/board/$boardId` | `routes/board.$boardId.tsx:15` | `Board ${boardId} -- Aegis` |
| `/issue/$issueKey/chat` | `routes/issue.$issueKey.chat.tsx:145` | `${issueKey} Chat -- Aegis` |
| `/issue/$issueKey/ide` | `routes/issue.$issueKey.ide.tsx:39` | `${issueKey} IDE -- Aegis` |
| `/settings` | `routes/settings.tsx:330` | `Settings -- Aegis` |
| `/auth/callback` | `routes/auth.callback.tsx:23` | `Authenticating... -- Aegis` |

All routes set `document.title` in a `useEffect` on mount with the appropriate dynamic values. The default title in `index.html:6` is `Aegis`.

**Verdict:** Correctly implemented.

---

### AC-3: [Pass] Sidebar links announce "current page" on the active route

**Evidence:** `packages/app/src/components/shared/Sidebar.tsx:12,23,32`

Each sidebar `<Link>` uses TanStack Router's `activeProps` to inject `aria-current: 'page'` when the link matches the current route:

```tsx
activeProps={{ className: 'bg-accent text-accent-foreground', 'aria-current': 'page' as const }}
```

This is applied to all three sidebar links (Home, Board, Settings). Screen readers (VoiceOver, NVDA, JAWS) announce this as "current page" when reading the navigation landmark.

The `<nav>` element at line 8 also has `aria-label="Main navigation"`, providing a landmark label.

**Verdict:** Correctly implemented.

---

### AC-4: [Pass] Board columns have h2 headings; cards announced with summary and priority text

**Evidence:**

- Column headings: `packages/app/src/components/board/Column.tsx:29`
  ```tsx
  <h2 className="text-sm font-semibold text-foreground">{name}</h2>
  ```
  Each column renders its status name as an `<h2>`.

- Card announcement: `packages/app/src/components/board/Card.tsx:56-73`
  Cards contain the issue key as text (line 60), the priority name as text (line 67), and the summary as a `<p>` element (lines 72-74). The priority color dot has `aria-hidden="true"` (line 65) so the decorative element is hidden from screen readers while the priority text label remains readable.

**Verdict:** Correctly implemented. The card content (key, summary, priority name) is all in readable text elements, so screen readers will announce all of it.

---

### AC-5: [Pass] Issue cards have `aria-selected` when keyboard-focused

**Evidence:** `packages/app/src/components/board/Card.tsx:52-53`

```tsx
tabIndex={isFocused ? 0 : -1}
aria-selected={isFocused}
```

The `CardContainer` receives `aria-selected={isFocused}` which is `true` when the card matches the currently focused index from the board store. The `tabIndex` is set to `0` when focused (making it tabbable) and `-1` otherwise (removing it from tab order). Visual focus is indicated by `ring-2 ring-primary shadow-md` at line 49.

**Verdict:** Correctly implemented.

---

### AC-6: [Pass] Drag-and-drop is operable via keyboard

**Evidence:** `packages/app/src/components/board/Card.tsx:36-41` (Draggable) and `packages/app/src/components/board/Column.tsx:36` (Droppable), using `@hello-pangea/dnd` v17.

`@hello-pangea/dnd` (a maintained fork of `react-beautiful-dnd`) provides built-in keyboard drag-and-drop support. The `dragHandleProps` spread onto the card wrapper at line 41 (`{...provided.dragHandleProps}`) inject keyboard event handlers, `tabIndex`, `role="button"`, and ARIA attributes automatically. Users can:

- Press `Space` to lift the dragged item
- Use arrow keys to move it between droppable zones
- Press `Space` again to drop
- Press `Escape` to cancel

The library also generates live region announcements (e.g., "You have lifted an item. Use arrow keys to move...") for screen reader users.

**Verdict:** Correctly implemented via the library's built-in keyboard DnD support.

---

### AC-7: [Pass] Chat textarea has `aria-label="Type a message"`

**Evidence:** `packages/app/src/components/chat/MessageInput.tsx:81`

```tsx
aria-label="Type a message"
```

The `<textarea>` also has `placeholder="Type a message..."` (line 80) and the send/stop buttons have their own `aria-label` attributes: `"Send message"` (line 100) and `"Stop generating"` (line 91).

**Verdict:** Correctly implemented.

---

### AC-8: [Pass] Tool result collapsibles have `role="button"`, `aria-expanded`, keyboard operation

**Evidence:** `packages/app/src/components/chat/ToolResult.tsx:29-35`

```tsx
<CardHeader
  className="cursor-pointer select-none p-3"
  onClick={toggle}
  onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
  role="button"
  tabIndex={0}
  aria-expanded={expanded}
>
```

All three required attributes are present:
- `role="button"` (line 33)
- `aria-expanded={expanded}` (line 35) -- toggles between `true`/`false`
- `tabIndex={0}` (line 34) -- makes it keyboard-focusable
- `onKeyDown` handler (line 32) -- responds to `Enter` and `Space` keys with `preventDefault()` to avoid scroll on Space

**Verdict:** Correctly implemented.

---

### AC-9: [Pass] IDE tabs have `role="tablist"` / `role="tab"` / `aria-selected`

**Evidence:** `packages/app/src/components/ide/EditorTabs.tsx:21,40-42`

```tsx
<div ... role="tablist" aria-label="Open files">
```

Each tab button:
```tsx
<button
  onClick={() => setActiveTab(index)}
  className="flex items-center gap-1.5"
  role="tab"
  aria-selected={isActive}
  aria-label={`${fileName}${tab.isDirty ? ' (modified)' : ''}`}
>
```

- `role="tablist"` on the container (line 21) with `aria-label="Open files"`
- `role="tab"` on each tab button (line 40)
- `aria-selected={isActive}` reflecting the active state (line 41)
- `aria-label` includes filename and modified indicator (line 42)
- Close buttons have `aria-label={`Close ${fileName}`}` (line 59)

**Verdict:** Correctly implemented.

---

### AC-10: [Pass] File explorer has `role="tree"` / `role="treeitem"` / `aria-expanded`

**Evidence:** `packages/app/src/components/ide/FileExplorer.tsx:104,159`

Tree container:
```tsx
<div className="p-1" role="tree" aria-label="File explorer">
```

Each tree item:
```tsx
<div role="treeitem" aria-expanded={isDirectory ? isExpanded : undefined}>
```

- `role="tree"` on the root container (line 159) with `aria-label="File explorer"`
- `role="treeitem"` on each item (line 104)
- `aria-expanded` is set to the expanded state for directories, and `undefined` for files (correctly omitted for non-expandable items)
- Child groups are wrapped in `<div role="group">` (line 130) per WAI-ARIA tree pattern

**Verdict:** Correctly implemented.

---

### AC-11: [Pass] Source control panel header has `aria-expanded`

**Evidence:** `packages/app/src/components/ide/SourceControl.tsx:115-118`

```tsx
<button
  onClick={() => setIsExpanded(!isExpanded)}
  className="flex w-full items-center justify-between px-3 py-2 hover:bg-accent"
  aria-expanded={isExpanded}
>
```

The source control header is a `<button>` element (semantically correct -- no need for `role="button"`) with `aria-expanded={isExpanded}` that toggles the panel content. The visual chevron icon changes between `ChevronDown` and `ChevronUp` to match the expanded state.

**Verdict:** Correctly implemented.

---

## Defects Found

No defects found. All 11 acceptance criteria for US-10 pass validation.

### Notes for Future Improvement (non-blocking)

- **N1**: The `role="tab"` buttons in `EditorTabs.tsx` do not have a corresponding `role="tabpanel"` on the content area. While the current implementation is functional, the full WAI-ARIA Tabs pattern recommends pairing `tablist`/`tab` with `tabpanel` elements linked via `aria-controls`/`aria-labelledby`. This is a best-practice enhancement, not a violation of the stated acceptance criteria.

- **N2**: The `role="treeitem"` elements in `FileExplorer.tsx` do not have `aria-label` attributes. The tree item text content (filename) is readable by screen readers via the button's inner text, so this is functional. Adding explicit `aria-label` or `aria-labelledby` could improve verbosity control.

- **N3**: Board cards use `aria-selected` on a `<div>` element (the Card component). Technically, `aria-selected` is intended for roles like `option`, `tab`, `row`, `gridcell`, or `treeitem`. A more semantically correct approach might be to use `role="option"` with an `aria-selected` or use `aria-current="true"` instead. However, screen readers do generally interpret `aria-selected` on generic elements, so this works in practice.
