# Proposal: Fix critical WCAG Level A accessibility violations

## Type: fix

## Source: UAT-3 (Accessibility) C1, C3, C4, C5, C7; UAT-3 U1, U3

## Problem
Multiple WCAG Level A violations block screen reader and keyboard-only users: no skip navigation link, no dynamic page titles, missing heading hierarchy on board/chat/IDE, color-only priority indicators on cards, unlabeled form inputs, and unlabeled navigation landmarks. These are fundamental accessibility requirements.

## Solution

1. **Skip navigation (`src/routes/__root.tsx`)**:
   - Add `id="main-content"` to the `<main>` element at line 79
   - Add a visually-hidden skip link as the first child of `<body>`: `<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground">Skip to main content</a>`

2. **Dynamic page titles (all route files)**:
   - Add a `useEffect` in each route to set `document.title`:
     - Home: `"Aegis"`
     - Board: `"Board - Aegis"`
     - Chat: `"${issueKey} Chat - Aegis"`
     - IDE: `"${issueKey} IDE - Aegis"`
     - Settings: `"Settings - Aegis"`
   - Or create a shared `usePageTitle(title: string)` hook used by each route

3. **Heading hierarchy**:
   - `BoardView.tsx`: Add `<h1 className="sr-only">Board</h1>` before the columns, change column headings from `h3` to `h2`
   - `issue.$issueKey.chat.tsx`: Add `<h1 className="sr-only">{issueKey} Chat</h1>`, change "Issue Context" from `h3` to `h2`
   - `issue.$issueKey.ide.tsx`: Add `<h1 className="sr-only">{issueKey} IDE</h1>`

4. **Priority indicators (`src/components/board/Card.tsx:57-60`)**:
   - Replace the 2x2 color dot with an icon or text label alongside the color
   - Add `aria-label` to the priority element: `aria-label={`Priority: ${priority.name}`}`
   - Use distinct shapes or icons per priority level (e.g., up-arrow for high, dash for medium, down-arrow for low) so color is not the sole differentiator

5. **Chat textarea label (`src/components/chat/MessageInput.tsx:75-83`)**:
   - Add `aria-label="Type a message to the AI assistant"` to the `<textarea>`

6. **Navigation landmark labels**:
   - `Sidebar.tsx`: Add `aria-label="Main navigation"` to the `<nav>` element
   - `Header.tsx`: Add `aria-label="Application header"` to the `<header>` element

7. **Filter bar search input (`src/components/board/FilterBar.tsx:63-70`)**:
   - Add `aria-label="Search issues"` to the search `<Input>`

## Effort: S

## Files affected
- `packages/app/src/routes/__root.tsx` (skip link, main id)
- `packages/app/src/routes/index.tsx` (page title)
- `packages/app/src/routes/board.$boardId.tsx` (page title)
- `packages/app/src/routes/issue.$issueKey.chat.tsx` (page title, h1)
- `packages/app/src/routes/issue.$issueKey.ide.tsx` (page title, h1)
- `packages/app/src/routes/settings.tsx` (page title)
- `packages/app/src/components/board/BoardView.tsx` (h1)
- `packages/app/src/components/board/Column.tsx` (h3 -> h2)
- `packages/app/src/components/board/Card.tsx` (priority indicator)
- `packages/app/src/components/chat/MessageInput.tsx` (textarea aria-label)
- `packages/app/src/components/shared/Sidebar.tsx` (nav aria-label)
- `packages/app/src/components/shared/Header.tsx` (header aria-label)
- `packages/app/src/components/board/FilterBar.tsx` (input aria-label)

## Test plan
- Automated: run axe-core or Lighthouse accessibility audit -- verify no Level A violations on home, board, chat, IDE, settings
- Manual: tab through the page with keyboard only -- first Tab should focus the skip link, Enter should jump to main content
- Manual: verify `document.title` changes on each route navigation
- Screen reader test (VoiceOver): navigate by headings on board page -- h1 "Board" should be announced, then h2 column headings
- Screen reader test: focus chat textarea -- "Type a message to the AI assistant" should be announced
- Screen reader test: focus a card's priority indicator -- "Priority: High" should be announced
- Visual test: priority indicators show distinct shapes/icons, not just color dots
