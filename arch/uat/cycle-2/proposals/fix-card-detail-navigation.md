# Proposal: Add navigation links from board cards to Chat and IDE views

## Type: fix

## Source: UAT-1 (New Contributor) U6; UAT-2 (Power User) U1

## Problem
There is no navigation path from a board card to the Chat or IDE views for that issue. Users must manually type URLs like `/issue/PROJ-123/chat`. The core user journey (see issue on board -> discuss with AI -> edit code) has missing transitions. Additionally, keyboard-navigated cards have no visual focus indicator, making `j`/`k` navigation feel broken.

## Solution

1. **CardDetail links (`src/components/board/CardDetail.tsx`)**:
   - Add two action buttons/links in the card detail panel:
     - "AI Chat" linking to `/issue/${issueKey}/chat`
     - "Open IDE" linking to `/issue/${issueKey}/ide`
   - Use TanStack Router `<Link>` components for client-side navigation
   - Place them prominently in the card detail header or as a button group

2. **IssueCard quick actions (`src/components/board/Card.tsx`)**:
   - The card already has "AI Chat" and "Open IDE" buttons (lines 106-129) but they may not be visible enough
   - Ensure these use `<Link>` for client-side navigation (not `window.location`)

3. **Focused card visual indicator (`src/components/board/Card.tsx` and `BoardView.tsx`)**:
   - Pass `focusedCardIndex` from the board store down through `Column` to `IssueCard`
   - Apply a visible focus ring (`ring-2 ring-primary`) to the card that matches the focused index
   - Ensure the focused card is scrolled into view when `j`/`k` changes the index

## Effort: S

## Files affected
- `packages/app/src/components/board/CardDetail.tsx` (add Chat/IDE links)
- `packages/app/src/components/board/Card.tsx` (focused card styling)
- `packages/app/src/components/board/Column.tsx` (pass focused index to cards)
- `packages/app/src/components/board/BoardView.tsx` (pass focused index to columns)

## Test plan
- Unit test: CardDetail renders Link to `/issue/${issueKey}/chat` and `/issue/${issueKey}/ide`
- Unit test: card with matching `focusedCardIndex` has focus ring class
- Manual test: open board, click a card to see detail, click "AI Chat" -- navigates to chat view for that issue
- Manual test: press `j` multiple times on board -- visible ring moves between cards
- Manual test: press `Enter` on focused card -- card detail opens
