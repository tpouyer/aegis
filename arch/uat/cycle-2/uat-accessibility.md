# UAT: Accessibility Auditor -- Cycle 2

Tested: All routes and interactive components across `packages/app/src/`
Standard: WCAG 2.1 AA
Date: 2026-05-07

---

## Critical Issues (blocks user journey)

### C1: No skip navigation link
- **Journey step**: Keyboard user loads any page and tries to skip past the header and sidebar to reach main content.
- **Expected**: A "Skip to main content" link should be the first focusable element on the page, allowing keyboard users to bypass repetitive navigation. The `<main>` element should have an `id` attribute so the skip link can target it (WCAG 2.4.1 Bypass Blocks, Level A).
- **Actual**: No skip link exists anywhere in the app. The `<main>` element in `__root.tsx:79` has no `id` attribute. A keyboard-only user must tab through the header (logo, theme toggle) and all three sidebar links on every single page load before reaching the page content.
- **Impact**: All keyboard-only and screen reader users are forced to navigate through repeated navigation on every page.
- **Files**: `packages/app/src/routes/__root.tsx:73-88`, `packages/app/src/components/shared/Header.tsx:24-38`, `packages/app/src/components/shared/Sidebar.tsx:6-37`

### C2: Drag-and-drop has no accessible keyboard alternative or ARIA semantics
- **Journey step**: Keyboard user on the board page tries to move an issue card from one status column to another.
- **Expected**: An alternative keyboard mechanism should exist (e.g., a context menu on each card with "Move to..." options). `@hello-pangea/dnd` provides some built-in keyboard support (Space to lift, arrow keys to move), but cards lack `aria-roledescription`, `aria-label`, and columns lack `aria-label` attributes to make drag interaction comprehensible to screen reader users (WCAG 2.1.1 Keyboard, Level A; WCAG 2.5.7 Dragging Movements, Level AA; WCAG 4.1.2 Name Role Value, Level A).
- **Actual**: The `IssueCard` component (`Card.tsx:35-132`) wraps cards in `Draggable` with drag handle props, but there are no ARIA attributes communicating that the element is draggable, what column it is in, or what will happen on drop. The card `<CardContainer>` at line 43 uses `onClick` but has no explicit `role`, `tabIndex`, or `aria-label`. The `Column` component (`Column.tsx:34-65`) `Droppable` zone has no `aria-label` identifying the status column. The `cursor-grab` class on line 44 is purely visual.
- **Impact**: Keyboard-only and screen reader users cannot effectively reorder or move cards between columns. This blocks the core workflow of transitioning issues on the board.
- **Files**: `packages/app/src/components/board/Card.tsx:35-50`, `packages/app/src/components/board/Column.tsx:34-65`

### C3: No page title updates on route changes
- **Journey step**: Screen reader user navigates between routes (Home, Board, Settings, Chat, IDE).
- **Expected**: The document title should update on each route change to reflect the current page (e.g., "Board - Aegis", "Settings - Aegis", "PROJ-123 Chat - Aegis"). Screen readers announce the page title on navigation (WCAG 2.4.2 Page Titled, Level A).
- **Actual**: The HTML `<title>` is set to a static "Aegis" in `index.html:5` and is never updated. There are no `document.title` assignments, no `useTitle` hooks, and no Helmet-like library in use. All routes share the same generic title. Confirmed via grep: zero instances of `document.title` assignment across the entire codebase.
- **Impact**: Screen reader users cannot tell which page they are on after navigation. Users with multiple tabs cannot distinguish pages.
- **Files**: `packages/app/index.html:5`, all route files in `packages/app/src/routes/`

### C4: Board, Chat, and IDE routes have no h1 heading
- **Journey step**: Screen reader user navigates to the board, chat, or IDE page and uses heading navigation (H key) to understand page structure.
- **Expected**: Every page should have exactly one h1 that describes the page content. Sub-sections should use h2, h3, etc. in proper hierarchy (WCAG 1.3.1 Info and Relationships, Level A; WCAG 2.4.6 Headings and Labels, Level AA).
- **Actual**: The board route (`board.$boardId.tsx`) renders `BoardView` which has no h1. Column headings are h3 (`Column.tsx:27`) with no parent h1/h2. The chat route (`issue.$issueKey.chat.tsx`) has an h3 for "Issue Context" (line 62) but no h1. The IDE route has no h1; "Aegis IDE" text at `IDELayout.tsx:153` is a `<span>`. Only the home page (`index.tsx:72`) and settings page (`settings.tsx:335`) have h1 elements. The CardDetail panel uses h4 sections with no h2/h3 parents.
- **Impact**: Screen reader heading navigation produces confusing results with gaps in hierarchy on 3 of 5 major routes.
- **Files**: `packages/app/src/components/board/BoardView.tsx`, `packages/app/src/components/board/Column.tsx:27`, `packages/app/src/routes/issue.$issueKey.chat.tsx:62`, `packages/app/src/components/ide/IDELayout.tsx:153`

### C5: Priority indicator on cards is color-only
- **Journey step**: Color-blind user views issue cards on the kanban board and tries to identify priority.
- **Expected**: Priority should be communicated through text, icons, or patterns in addition to color (WCAG 1.4.1 Use of Color, Level A; WCAG 1.1.1 Non-text Content, Level A).
- **Actual**: The priority indicator in `Card.tsx:57-60` is a 2x2 pixel colored dot (`h-2 w-2 rounded-full`) with only a `title` attribute for the name. Color is the sole differentiator: red for highest, orange for high, yellow for medium, blue for low, slate for lowest (`Card.tsx:159-172`). The `title` attribute is not reliably exposed to screen readers on non-interactive span elements and does not appear on touch devices.
- **Impact**: Color-blind users (~8% of males) cannot determine issue priority. Screen reader users receive no priority information at all.
- **Files**: `packages/app/src/components/board/Card.tsx:57-60`, `packages/app/src/components/board/Card.tsx:159-172`

### C6: ToolResult collapsible has no keyboard semantics
- **Journey step**: Keyboard user in the chat view tries to expand a tool call result card.
- **Expected**: The collapsible header should be a `<button>` with `aria-expanded` indicating the current state, `aria-controls` linking to the content, and keyboard operability (WCAG 2.1.1 Keyboard, Level A; WCAG 4.1.2 Name Role Value, Level A).
- **Actual**: The `ToolResult` component (`ToolResult.tsx:29-31`) uses a `CardHeader` (renders as `<div>`) with `onClick={toggle}` and `className="cursor-pointer"`. There is no `aria-expanded`, no `role="button"`, no `tabIndex`, and no `onKeyDown` handler. Keyboard users cannot focus or activate this element.
- **Impact**: Keyboard-only users cannot expand tool call results. Screen reader users receive no indication this is interactive.
- **Files**: `packages/app/src/components/chat/ToolResult.tsx:28-49`

### C7: Chat message textarea has no accessible label
- **Journey step**: Screen reader user focuses the message input in the chat view.
- **Expected**: The textarea should have an accessible name via `<label>`, `aria-label`, or `aria-labelledby` (WCAG 1.3.1, WCAG 4.1.2).
- **Actual**: The `<textarea>` in `MessageInput.tsx:75-83` has `placeholder="Type a message..."` but no `aria-label`, no `<label>` element, and no `aria-labelledby`. Placeholder text disappears on focus and is not a reliable accessible name.
- **Impact**: Screen reader users may not know the purpose of the textarea.
- **Files**: `packages/app/src/components/chat/MessageInput.tsx:75-83`

### C8: Editor tabs lack ARIA tab pattern
- **Journey step**: Screen reader user navigates open file tabs in the IDE.
- **Expected**: Tabs should follow WAI-ARIA tab pattern: `role="tablist"` on the container, `role="tab"` and `aria-selected` on each tab, `role="tabpanel"` on the associated content (WCAG 4.1.2 Name Role Value, Level A).
- **Actual**: `EditorTabs.tsx` renders tabs as plain `<div>` containers with nested `<button>` elements. No `role="tablist"`, no `role="tab"`, no `aria-selected`. The close button at line 47 has `title="Close"` but no `aria-label` specifying which file tab will be closed.
- **Impact**: Screen readers cannot identify the tab interface. Users cannot determine which tab is active.
- **Files**: `packages/app/src/components/ide/EditorTabs.tsx:13-65`

### C9: File explorer tree has no ARIA tree semantics
- **Journey step**: Screen reader user navigates the file tree in the IDE.
- **Expected**: Tree views should use `role="tree"` on the container, `role="treeitem"` on nodes, `aria-expanded` on directories, `aria-level` for depth (WAI-ARIA Tree View pattern; WCAG 4.1.2).
- **Actual**: The `FileExplorer` component (`FileExplorer.tsx:145-176`) renders a flat list of `<button>` elements nested in plain `<div>` elements. No `role="tree"`, no `role="treeitem"`, no `aria-expanded` on directory buttons, no `aria-level`. Screen readers perceive this as a flat list of buttons with no hierarchy.
- **Impact**: Screen reader users cannot understand the file hierarchy or navigate it efficiently.
- **Files**: `packages/app/src/components/ide/FileExplorer.tsx:82-176`

---

## UX Issues (confusing or frustrating)

### U1: Sidebar navigation has no aria-label
- **Journey step**: Screen reader user uses landmark navigation to find the sidebar.
- **Expected**: The `<nav>` element should have an `aria-label` (e.g., "Main navigation") to distinguish it from other navigation landmarks (WCAG 1.3.1).
- **Actual**: `Sidebar.tsx:7` contains a `<nav>` with no `aria-label` or `aria-labelledby`. TanStack Router `activeProps` adds a visual CSS class but does not set `aria-current="page"` on the active link.
- **Impact**: When multiple `<nav>` elements exist, screen readers list them generically.
- **Files**: `packages/app/src/components/shared/Sidebar.tsx:6-37`

### U2: ProviderPicker form labels not associated with inputs
- **Journey step**: Screen reader user configures an LLM provider in the ProviderPicker dialog.
- **Expected**: Each `<label>` should use `htmlFor` pointing to the corresponding input's `id` (WCAG 1.3.1, WCAG 4.1.2).
- **Actual**: Labels in `ProviderPicker.tsx:294,307,320` have no `htmlFor` attributes and the `<Input>` components have no `id` attributes. Clicking the label text does not focus the input.
- **Impact**: Screen readers may not associate labels with fields. Label-click-to-focus behavior is broken.
- **Files**: `packages/app/src/components/chat/ProviderPicker.tsx:293-329`

### U3: Filter bar search input has no accessible label
- **Journey step**: Screen reader user tabs to the filter bar search input on the board page.
- **Expected**: The input should have `aria-label`, `<label>`, or `aria-labelledby` (WCAG 4.1.2).
- **Actual**: The `<Input>` in `FilterBar.tsx:63-70` has `placeholder="Search issues..."` but no `aria-label` and no `<label>`. The Search icon is decorative.
- **Impact**: Screen readers announce an unnamed text field.
- **Files**: `packages/app/src/components/board/FilterBar.tsx:63-70`

### U4: Provider option buttons have no selection semantics
- **Journey step**: Selecting an LLM provider in the ProviderPicker dialog.
- **Expected**: Selection controls should communicate selected state via `aria-pressed`, `aria-selected`, or radio group pattern (WCAG 4.1.2).
- **Actual**: Provider options at `ProviderPicker.tsx:253-286` are plain `<button>` elements. The selected one gets a different border color class but has no `aria-pressed`, `aria-selected`, or radio group pattern.
- **Impact**: Screen reader users cannot tell which provider is currently selected.
- **Files**: `packages/app/src/components/chat/ProviderPicker.tsx:253-286`

### U5: No focus management on route changes
- **Journey step**: Navigating between routes (e.g., Home to Board, Board to Chat).
- **Expected**: Focus should move to the main content area or h1 on route change (WCAG 2.4.3 Focus Order).
- **Actual**: `__root.tsx` has no focus management on navigation. TanStack Router does not manage focus by default. After clicking a sidebar link, focus remains on the sidebar.
- **Impact**: Screen reader users do not receive an announcement that page content has changed.
- **Files**: `packages/app/src/routes/__root.tsx`

### U6: Source control panel toggle lacks aria-expanded
- **Journey step**: Screen reader user encounters the Source Control collapsible panel in the IDE.
- **Expected**: The toggle button should have `aria-expanded` and `aria-controls` (WCAG 4.1.2).
- **Actual**: The `<button>` in `SourceControl.tsx:115-135` toggles `isExpanded` state but has no `aria-expanded`, `aria-controls`, or `aria-label`. Only chevron icons indicate state.
- **Impact**: Screen reader users cannot tell if the panel is open or closed.
- **Files**: `packages/app/src/components/ide/SourceControl.tsx:115-135`

### U7: Commit message input has no label
- **Journey step**: Writing a commit message in the IDE source control panel.
- **Expected**: Input should have an associated label (WCAG 3.3.2 Labels or Instructions).
- **Actual**: The `<Input>` at `SourceControl.tsx:210-214` uses `placeholder="Commit message..."` but has no `aria-label` or `<label>`.
- **Impact**: Screen readers announce an unnamed text input.
- **Files**: `packages/app/src/components/ide/SourceControl.tsx:210-215`

### U8: Chat message list has no ARIA live region for new messages
- **Journey step**: Screen reader user waiting for an AI response; assistant starts streaming text.
- **Expected**: New messages or streaming content should be announced via `aria-live` region. The container should use `role="log"` (WCAG 4.1.3 Status Messages, Level AA).
- **Actual**: The `MessageList` component (`MessageList.tsx:43-58`) is a `ScrollArea` with no `aria-live` attribute. The streaming indicator at lines 49-53 ("Generating...") is not in a live region.
- **Impact**: Screen reader users do not know when AI has responded or is currently generating.
- **Files**: `packages/app/src/components/chat/MessageList.tsx:43-58`

### U9: Chat message bubbles have no semantic structure
- **Journey step**: Screen reader user reads the chat conversation.
- **Expected**: Messages should use list structure (`role="log"` or `<ol>`) with sender identification (WCAG 1.3.1).
- **Actual**: Messages are rendered as sibling `<div>` elements with no list semantics and no programmatic indication of sender. Differentiation is purely visual (right-aligned blue for user, left-aligned muted for assistant).
- **Impact**: Screen reader users cannot distinguish user from assistant messages or navigate by list item.
- **Files**: `packages/app/src/components/chat/MessageList.tsx:43-58,65-101`

### U10: MonacoDiffView and IDE Code/Diff toggle buttons lack accessible labels and pressed state
- **Journey step**: Screen reader user switches between side-by-side/inline diff or Code/Diff view.
- **Expected**: Icon-only buttons should have `aria-label`; toggle state should use `aria-pressed` (WCAG 4.1.2).
- **Actual**: `MonacoDiffView.tsx:49-71` buttons use `title` attributes (less reliable for screen readers than `aria-label`) and no `aria-pressed`. `IDELayout.tsx:163-186` Code/Diff buttons likewise have no `aria-pressed`. Active state is indicated only by CSS class.
- **Impact**: Screen reader users cannot determine which mode is active or what the buttons do.
- **Files**: `packages/app/src/components/ide/MonacoDiffView.tsx:49-71`, `packages/app/src/components/ide/IDELayout.tsx:162-186`

### U11: Onboarding wizard progress indicator is not accessible
- **Journey step**: Going through the onboarding wizard.
- **Expected**: Progress indicators should be labeled (WCAG 1.3.1).
- **Actual**: Progress dots at `OnboardingWizard.tsx:138-150` are colored `<div>` elements with no labels, no `role="progressbar"`, no `aria-valuenow`. The `DialogDescription` shows "Step X of Y" which partially addresses this.
- **Impact**: The visual progress bar conveys no information to screen readers.
- **Files**: `packages/app/src/components/shared/OnboardingWizard.tsx:138-151`

### U12: EditorTabs close button lacks descriptive aria-label
- **Journey step**: Screen reader user tries to close a specific file tab.
- **Expected**: Close button should include the filename: `aria-label="Close filename.ts"` (WCAG 4.1.2).
- **Actual**: Close button at `EditorTabs.tsx:47-56` has `title="Close"` but no `aria-label`. Screen readers hear "button" with no description of which tab it closes.
- **Impact**: When multiple tabs are open, screen reader users cannot identify which close button corresponds to which file.
- **Files**: `packages/app/src/components/ide/EditorTabs.tsx:47-56`

---

## Polish Items (works but could be better)

### P1: Code copy button only visible on hover, not on keyboard focus
- **Journey step**: Copying code from AI chat response.
- **Expected**: Interactive elements should always be perceivable when focused (WCAG 2.1.1, 2.4.7).
- **Actual**: `MessageList.tsx:147` copy button uses `opacity-0 group-hover:opacity-100` which makes it visible only on mouse hover. Missing `focus-visible:opacity-100` or `focus-within:opacity-100`.
- **Impact**: Keyboard users can tab to the button but it remains invisible.
- **Files**: `packages/app/src/components/chat/MessageList.tsx:145-157`

### P2: Loading spinner has no screen reader announcement
- **Suggestion**: The `Loading` component (`Loading.tsx:9-18`) shows a spinning icon and optional message but has no `role="status"` or `aria-live` region. Add `role="status"` and `aria-live="polite"` to the container.
- **Files**: `packages/app/src/components/shared/Loading.tsx:9-18`

### P3: ErrorBoundary retry button should receive focus on error and lacks focus ring
- **Suggestion**: When `ErrorBoundary` renders its fallback, focus remains elsewhere. The "Try again" button should receive focus automatically. Additionally, the button at `ErrorBoundary.tsx:48-50` uses custom classes without `focus-visible:ring` styles (unlike the standard `Button` component).
- **Files**: `packages/app/src/components/shared/ErrorBoundary.tsx:38-55`

### P4: Text-[10px] size used extensively for badges
- **Suggestion**: `text-[10px]` is used on badges throughout the app (`Card.tsx:72,82`, `Column.tsx:28`, `FilterBar.tsx:72`, `SourceControl.tsx:199`, etc.). At 10px, text is challenging for users with low vision. Combined with `text-muted-foreground` (#737373 on #fafafa = ~4.6:1), contrast is borderline at this size. Consider a minimum of 12px (`text-xs`) for all text content.
- **Files**: Multiple component files

### P5: Settings auth connection status dot has aria-label on non-interactive div
- **Suggestion**: The status dot at `settings.tsx:111-112` is a `<div>` with `aria-label`. The `aria-label` is not reliably announced on non-interactive elements. Since the Badge text already conveys status, consider adding `aria-hidden="true"` to the dot instead.
- **Files**: `packages/app/src/routes/settings.tsx:110-113`

### P6: CardDetail Esc hint is decorative
- **Suggestion**: The `<kbd>Esc</kbd>` element at `CardDetail.tsx:39-41` is positioned absolutely and purely decorative. The Sheet component already handles Esc via Radix. Consider adding `aria-hidden="true"` to avoid confusing screen readers.
- **Files**: `packages/app/src/components/board/CardDetail.tsx:39-41`

### P7: ApplyBlock accept/reject state changes should be announced
- **Suggestion**: When Accept or Reject is clicked in `ApplyBlock.tsx`, the status messages at lines 70-76 and 80-86 are not in a live region. Add `role="status"` to announce outcomes.
- **Files**: `packages/app/src/components/ide/ApplyBlock.tsx:69-87`

### P8: Keyboard shortcut overlay not discoverable without keyboard
- **Suggestion**: The `?` shortcut to open the help overlay is not communicated to screen reader users in any visible UI element. Consider adding a "Keyboard shortcuts" link in Settings or the sidebar.
- **Files**: `packages/app/src/components/shared/ShortcutHelp.tsx`

### P9: Card container is clickable but not announced as interactive
- **Suggestion**: The `CardContainer` in `Card.tsx:43` has `onClick` but is a `<div>`. Screen readers will not announce it as interactive. Consider adding `role="button"` and `tabIndex={0}` with keyboard event handling, coordinated with drag handle props.
- **Files**: `packages/app/src/components/board/Card.tsx:43-50`

---

## Positive Observations

- **Dialog/Sheet components use Radix primitives correctly**: All dialogs and sheets use `@radix-ui/react-dialog` providing proper focus trapping, escape-to-close, overlay click-to-dismiss, and return-focus behavior. `DialogTitle`, `DialogDescription`, `SheetTitle`, and `SheetDescription` are properly used in TransitionModal, ShortcutHelp, ProviderPicker, OnboardingWizard, and CommandPalette.
- **Command palette has excellent accessibility**: The `CommandPalette` component uses `role="listbox"` with `role="option"` items, `aria-selected` state, keyboard navigation (ArrowUp/Down/Enter/Escape), auto-focus on open, scroll-into-view for the selected item, and a visually hidden `DialogTitle` with `sr-only` class.
- **Toast notifications use proper live regions**: The `Toaster` component correctly uses `aria-live="polite"` on the container and `role="alert"` on individual toasts. The dismiss button has `aria-label="Dismiss notification"`.
- **EmptyState has good semantics**: Uses `role="status"`, `aria-label={title}`, and `aria-hidden="true"` on the decorative icon.
- **Button component has proper focus styles**: Includes `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring` for consistent, visible keyboard focus indication across the app.
- **Input component has focus styles**: Includes `focus-visible:ring-1` for visible keyboard focus.
- **Chat input buttons have aria-labels**: `MessageInput.tsx` properly labels icon-only Send and Stop buttons with `aria-label="Send message"` and `aria-label="Stop generating"`.
- **Header theme toggle has aria-label**: `Header.tsx:33` has `aria-label="Toggle theme"`.
- **HTML lang attribute is present**: `index.html` has `lang="en"` satisfying WCAG 3.1.1.
- **Viewport meta is correct**: `width=device-width, initial-scale=1.0` is properly configured.
- **Dropdown menus use Radix primitives**: All `DropdownMenu` components use `@radix-ui/react-dropdown-menu` providing keyboard navigation, proper ARIA roles, and focus management.
- **TransitionModal has proper label/input associations**: The only form that correctly uses `htmlFor` and `id` to associate labels with fields.
- **Settings tabs use Radix primitives**: The Tabs component uses `@radix-ui/react-tabs` providing proper `role="tablist"`, `role="tab"`, `aria-selected`, and keyboard navigation.
- **Keyboard shortcuts are well implemented**: Comprehensive shortcut system with J/K card navigation, F to focus filter, Cmd+K command palette, G B/G S chord navigation, ? for help overlay. Shortcuts are correctly suppressed in editable fields (inputs, textareas, contenteditable).
- **Color scheme has adequate primary text contrast**: CSS custom properties provide foreground (#0a0a0a) on background (#fafafa) in light mode and (#fafafa) on (#0a0a0a) in dark mode, both exceeding 15:1 contrast ratio for primary text.
- **Chat context panel toggle has aria-label**: `issue.$issueKey.chat.tsx:192` provides `aria-label` that changes based on panel state ("Close context panel" / "Open context panel").
