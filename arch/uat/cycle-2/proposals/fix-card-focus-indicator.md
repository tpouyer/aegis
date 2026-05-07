# Proposal: Add Visual Focus Indicator for Board Cards

## Type: fix
## Source: UAT-2 U3, UAT-2 U6, UAT-3 C2
## Problem: Keyboard navigation with j/k keys tracks `focusedCardIndex` in Zustand but never applies visual styling to the focused card, making keyboard navigation invisible and unusable.
## Solution:
1. Pass `isFocused` prop to `IssueCard` component based on `focusedCardIndex`
2. Add focus ring styling when `isFocused` is true
3. Add `tabIndex` and `aria-selected` for accessibility
4. Scroll focused card into view

In `Column.tsx`, pass focused state:
```tsx
<IssueCard
  key={issue.key}
  issue={issue}
  index={index}
  onClick={onCardClick}
  isFocused={focusedIndex === globalIndex}
/>
```

In `Card.tsx`, apply styling:
```tsx
<CardContainer
  className={cn(
    'cursor-grab transition-shadow',
    snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/30' : 'hover:shadow-md',
    isFocused && 'ring-2 ring-primary shadow-md',
  )}
  tabIndex={isFocused ? 0 : -1}
  aria-selected={isFocused}
  ref={isFocused ? focusRef : undefined}
>
```

## Effort: S
## Files affected:
- `src/components/board/Card.tsx`
- `src/components/board/Column.tsx`
- `src/components/board/BoardView.tsx`
## Test plan:
- Press j/k on board → focused card shows visible ring highlight
- Focused card scrolls into view
- Screen reader announces "selected" state
- Pressing Enter on focused card opens detail
